"use client";

import { io, type Socket } from "socket.io-client";
import type {
  ActionReceipt, ClientToServerEvents, CreateRoomRequest, JoinRoomRequest,
  RealtimeAction, RealtimeResult, RealtimeSession, ServerToClientEvents,
} from "@/types/realtime";
import type { GuestActionInput, NetGameView, Room, RoomSettings, Wind } from "@/types/multiplayer";
import { actionContext, applySyncPacket, expandView, SYNC_PROTOCOL, type CompactView } from "./syncProtocol";

type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
interface StoredSession { code: string; clientId: string; name: string; sessionToken: string }
export interface RealtimeConnection {
  status: "idle" | "connecting" | "connected" | "reconnecting";
  latencyMs: number | null;
  lastActionMs: number | null;
}

const SESSION_KEY = "kwx:realtime-session";
const ACK_TIMEOUT = 2_500;
let socket: RealtimeSocket | undefined;
let storedSession: StoredSession | undefined;
let activeRoomCode: string | undefined;
let latestView: NetGameView | undefined;
let baseline: CompactView | undefined;
let connectionEpoch = 0;
let connectionFailure: Error | undefined;
let probeTimer: ReturnType<typeof setInterval> | undefined;
let resync: Promise<boolean> | undefined;
const initialConnection: RealtimeConnection = { status: "idle", latencyMs: null, lastActionMs: null };
let connection = initialConnection;
const connectionListeners = new Set<() => void>();
const roomListeners = new Set<(room: Room) => void>();
const closedListeners = new Set<(message: string) => void>();
const viewListeners = new Set<(view: NetGameView) => void>();

export const getRealtimeConnection = () => connection;
export const getInitialRealtimeConnection = () => initialConnection;
export function subscribeRealtimeConnection(listener: () => void) {
  connectionListeners.add(listener);
  return () => { connectionListeners.delete(listener); };
}
function updateConnection(update: Partial<RealtimeConnection>) {
  connection = { ...connection, ...update };
  connectionListeners.forEach((listener) => listener());
}

export function loadRealtimeSession() {
  if (storedSession || typeof window === "undefined") return storedSession;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) {
      const value = JSON.parse(raw) as StoredSession;
      if (/^\d{4}$/.test(value.code) && typeof value.clientId === "string"
        && typeof value.name === "string" && typeof value.sessionToken === "string") storedSession = value;
      else window.localStorage.removeItem(SESSION_KEY);
    }
  } catch { window.localStorage.removeItem(SESSION_KEY); }
  return storedSession;
}
function saveStoredSession(next: StoredSession | undefined) {
  storedSession = next;
  if (typeof window === "undefined") return;
  if (next) window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  else window.localStorage.removeItem(SESSION_KEY);
}
function publishView(view: NetGameView) {
  if (view.roomCode && activeRoomCode && view.roomCode !== activeRoomCode) return;
  if (latestView && view.rev < latestView.rev) return;
  latestView = view;
  viewListeners.forEach((listener) => listener(view));
}
export function restoreAuthoritativeView() {
  if (latestView) viewListeners.forEach((listener) => listener(latestView!));
}
function stopProbe() {
  if (probeTimer) clearInterval(probeTimer);
  probeTimer = undefined;
}
function startProbe(active: RealtimeSocket) {
  stopProbe();
  const probe = async () => {
    if (!active.connected || connection.status !== "connected") return;
    const epoch = connectionEpoch;
    const started = performance.now();
    try {
      const result = await active.timeout(ACK_TIMEOUT).emitWithAck("realtime:ping");
      if (epoch === connectionEpoch) {
        updateConnection({ latencyMs: Math.round(performance.now() - started) });
        if (result.ok && result.data?.round && result.data.roomCode === activeRoomCode
          && (!latestView || latestView.round !== result.data.round || latestView.rev < result.data.rev)) {
          void requestRealtimeSync();
        }
      }
    } catch {
      if (epoch === connectionEpoch) updateConnection({ latencyMs: null });
    }
  };
  void probe();
  probeTimer = setInterval(() => { void probe(); }, 10_000);
}

function ensureSocket(): RealtimeSocket {
  if (socket) return socket;
  socket = io(process.env.NEXT_PUBLIC_REALTIME_URL || undefined, {
    autoConnect: false, reconnection: true,
    transports: ["websocket", "polling"], tryAllTransports: true,
    timeout: 5_000, reconnectionDelay: 350, reconnectionDelayMax: 2_500,
    auth: { syncProtocol: SYNC_PROTOCOL },
  });
  const active = socket;
  active.on("room:update", (room) => {
    if (!activeRoomCode || room.code === activeRoomCode) roomListeners.forEach((listener) => listener(room));
  });
  active.on("room:closed", (message) => {
    // The leave acknowledgement follows this event on the same connection.
    clearRealtimeSession(false);
    closedListeners.forEach((listener) => listener(message));
  });
  active.on("game:view", publishView);
  active.on("game:sync", (packet) => {
    if (packet.roomCode && activeRoomCode && packet.roomCode !== activeRoomCode) return;
    if (baseline && (packet.rev < baseline.rev || packet.kind === "patch" && packet.rev === baseline.rev)) return;
    const next = applySyncPacket(baseline, packet);
    if (!next) { void requestRealtimeSync(); return; }
    baseline = next;
    publishView(expandView(next));
  });
  active.on("disconnect", () => {
    connectionEpoch += 1;
    stopProbe();
    updateConnection({ status: storedSession ? "reconnecting" : "idle", latencyMs: null });
  });
  active.on("connect", async () => {
    connectionFailure = undefined;
    const epoch = ++connectionEpoch;
    updateConnection({ status: "connecting", latencyMs: null });
    const session = loadRealtimeSession();
    if (session) {
      activeRoomCode ??= session.code;
      try {
        const result = await active.timeout(5_000).emitWithAck("room:join", { ...session });
        if (epoch !== connectionEpoch) return;
        if (!result.ok) {
          connectionFailure = new Error(result.error);
          clearRealtimeSession();
          closedListeners.forEach((listener) => listener(result.error));
          return;
        }
        saveStoredSession({ ...session, sessionToken: result.data.sessionToken });
      } catch {
        if (epoch === connectionEpoch && active.connected) active.io.engine.close();
        return;
      }
    }
    if (epoch !== connectionEpoch || !active.connected) return;
    updateConnection({ status: "connected" });
    startProbe(active);
  });
  return active;
}

async function connected(): Promise<RealtimeSocket> {
  const active = ensureSocket();
  if (active.connected && connection.status === "idle" && !loadRealtimeSession()) {
    updateConnection({ status: "connected" });
    startProbe(active);
  }
  if (active.connected && connection.status === "connected") return active;
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); connectionListeners.delete(check); };
    const check = () => {
      if (active.connected && connection.status === "connected") { cleanup(); resolve(active); }
      else if (connection.status === "idle" && connectionFailure) { cleanup(); reject(connectionFailure); }
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error("实时服务连接超时，请检查网络后重试")); }, 12_000);
    connectionListeners.add(check);
    updateConnection({ status: loadRealtimeSession() ? "reconnecting" : "connecting" });
    active.connect();
    check();
  });
}
async function emitAck<T>(event: keyof ClientToServerEvents, ...args: unknown[]): Promise<T> {
  const active = await connected();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("服务器响应超时")), 8_000);
    const ack = (result: RealtimeResult<T>) => {
      clearTimeout(timer);
      if (result.ok) resolve(result.data);
      else reject(new Error(result.error));
    };
    (active.emit as (...params: unknown[]) => void)(event, ...args, ack);
  });
}
export function requestRealtimeSync(): Promise<boolean> {
  if (resync) return resync;
  if (!loadRealtimeSession()) return Promise.resolve(false);
  resync = (async () => {
    try {
      const active = await connected();
      const result = await active.timeout(ACK_TIMEOUT).emitWithAck("game:resync");
      return result.ok;
    } catch { return false; }
    finally { resync = undefined; }
  })();
  return resync;
}
function remember(session: RealtimeSession, clientId: string, name: string) {
  activeRoomCode = session.room.code;
  saveStoredSession({ code: session.room.code, clientId, name, sessionToken: session.sessionToken });
}
export async function createRealtimeRoom(request: CreateRoomRequest) {
  latestView = undefined;
  baseline = undefined;
  const session = await emitAck<RealtimeSession>("room:create", request);
  remember(session, request.clientId, request.name);
  return session;
}
export async function joinRealtimeRoom(request: JoinRoomRequest) {
  activeRoomCode = request.code;
  latestView = undefined;
  baseline = undefined;
  const session = await emitAck<RealtimeSession>("room:join", request);
  remember(session, request.clientId, request.name);
  return session;
}
export function savedSessionFor(code: string) {
  const session = loadRealtimeSession();
  return session?.code === code ? session : undefined;
}
export function clearRealtimeSession(disconnect = true) {
  connectionEpoch += 1;
  latestView = undefined;
  baseline = undefined;
  activeRoomCode = undefined;
  saveStoredSession(undefined);
  stopProbe();
  if (disconnect) socket?.disconnect();
  updateConnection({ ...initialConnection });
}
export function subscribeRoom(listener: (room: Room) => void) {
  roomListeners.add(listener);
  return () => { roomListeners.delete(listener); };
}
export function subscribeRoomClosed(listener: (message: string) => void) {
  closedListeners.add(listener);
  return () => { closedListeners.delete(listener); };
}
export function subscribeGameView(listener: (view: NetGameView) => void) {
  viewListeners.add(listener);
  if (latestView) listener(latestView);
  return () => { viewListeners.delete(listener); };
}
export const chooseRealtimeWind = (wind: Wind) => emitAck<Room>("room:choose-wind", wind);
export const updateRealtimeSettings = (settings: RoomSettings) => emitAck<Room>("room:update-settings", settings);
export const startRealtimeGame = () => emitAck<Room>("room:start");
export const readyRealtimeRound = (round: number) => emitAck<Room>("room:ready", round);
export const sendRealtimeChat = (text: string) => emitAck<void>("room:chat", text);
export const leaveRealtimeRoom = () => emitAck<void>("room:leave");

export async function sendRealtimeAction(action: Omit<GuestActionInput, "seat">): Promise<ActionReceipt> {
  if (connection.status !== "connected" || !socket?.connected) throw new Error("正在重连，请恢复连接后再操作");
  const session = loadRealtimeSession();
  const view = latestView;
  if (!session || !view?.round) throw new Error("正在恢复牌局，请稍后再操作");
  const request: RealtimeAction = {
    ...action, actionId: globalThis.crypto?.randomUUID?.() ?? `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    round: view.round, context: view.actionContext ?? actionContext(view.state, view.round),
  };
  const started = performance.now();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let result: RealtimeResult<ActionReceipt>;
    try {
      const active = await connected();
      if (storedSession?.sessionToken !== session.sessionToken || storedSession.code !== session.code) {
        throw new Error("牌局会话已结束");
      }
      if (!active.connected || connection.status !== "connected") throw new Error("连接正在恢复");
      result = await active.timeout(ACK_TIMEOUT).emitWithAck("game:action", request);
    } catch {
      if (storedSession?.sessionToken !== session.sessionToken) throw new Error("牌局会话已结束");
      if (attempt < 2) continue;
      restoreAuthoritativeView();
      void requestRealtimeSync();
      throw new Error("操作确认超时，正在校正牌局，请稍后重试");
    }
    if (!result.ok) {
      restoreAuthoritativeView();
      void requestRealtimeSync();
      throw new Error(result.error);
    }
    const receipt = result.data ?? { actionId: request.actionId, round: view.round, rev: latestView?.rev ?? view.rev };
    if (!latestView || latestView.rev < receipt.rev) await requestRealtimeSync();
    updateConnection({ lastActionMs: Math.round(performance.now() - started) });
    return receipt;
  }
  throw new Error("操作确认超时");
}
