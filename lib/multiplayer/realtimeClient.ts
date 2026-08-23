"use client";

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  CreateRoomRequest,
  JoinRoomRequest,
  RealtimeResult,
  RealtimeSession,
  ServerToClientEvents,
} from "@/types/realtime";
import type { NetGameView, Room, RoomSettings, Wind } from "@/types/multiplayer";

type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface StoredSession {
  code: string;
  clientId: string;
  name: string;
  sessionToken: string;
}

const SESSION_KEY = "kwx:realtime-session";
let socket: RealtimeSocket | undefined;
let storedSession: StoredSession | undefined;
let latestView: NetGameView | undefined;
const roomListeners = new Set<(room: Room) => void>();
const closedListeners = new Set<(message: string) => void>();
const viewListeners = new Set<(view: NetGameView) => void>();

function endpoint() {
  return process.env.NEXT_PUBLIC_REALTIME_URL || undefined;
}

function loadStoredSession() {
  if (storedSession || typeof window === "undefined") return storedSession;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) storedSession = JSON.parse(raw) as StoredSession;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
  }
  return storedSession;
}

function saveStoredSession(next: StoredSession | undefined) {
  storedSession = next;
  if (typeof window === "undefined") return;
  if (next) window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  else window.localStorage.removeItem(SESSION_KEY);
}

function ensureSocket(): RealtimeSocket {
  if (socket) return socket;
  socket = io(endpoint(), { autoConnect: false, reconnection: true });
  socket.on("room:update", (room) => roomListeners.forEach((listener) => listener(room)));
  socket.on("room:closed", (message) => closedListeners.forEach((listener) => listener(message)));
  socket.on("game:view", (view) => {
    latestView = view;
    viewListeners.forEach((listener) => listener(view));
  });
  socket.on("connect", () => {
    const session = loadStoredSession();
    if (!session) return;
    socket!.emit("room:join", { ...session }, (result) => {
      if (!result.ok) {
        clearRealtimeSession();
        closedListeners.forEach((listener) => listener(result.error));
        return;
      }
      saveStoredSession({ ...session, sessionToken: result.data.sessionToken });
    });
  });
  return socket;
}

async function connected() {
  const active = ensureSocket();
  if (active.connected) return active;
  return new Promise<RealtimeSocket>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      active.off("connect", onConnect);
      active.off("connect_error", onError);
      reject(new Error("实时服务连接超时"));
    }, 8_000);
    const onConnect = () => {
      window.clearTimeout(timer);
      active.off("connect_error", onError);
      resolve(active);
    };
    const onError = () => {
      window.clearTimeout(timer);
      active.off("connect", onConnect);
      reject(new Error("无法连接实时服务"));
    };
    active.once("connect", onConnect);
    active.once("connect_error", onError);
    active.connect();
  });
}

async function emitAck<T>(event: keyof ClientToServerEvents, ...args: unknown[]): Promise<T> {
  const active = await connected();
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("服务器响应超时")), 8_000);
    const ack = (result: RealtimeResult<T>) => {
      window.clearTimeout(timeout);
      if (result.ok) resolve(result.data);
      else reject(new Error(result.error));
    };
    (active.emit as (...params: unknown[]) => void)(event, ...args, ack);
  });
}

function remember(session: RealtimeSession, clientId: string, name: string) {
  latestView = undefined;
  saveStoredSession({ code: session.room.code, clientId, name, sessionToken: session.sessionToken });
}

export async function createRealtimeRoom(request: CreateRoomRequest) {
  const session = await emitAck<RealtimeSession>("room:create", request);
  remember(session, request.clientId, request.name);
  return session;
}

export async function joinRealtimeRoom(request: JoinRoomRequest) {
  const session = await emitAck<RealtimeSession>("room:join", request);
  remember(session, request.clientId, request.name);
  return session;
}

export function savedSessionFor(code: string) {
  const session = loadStoredSession();
  return session?.code === code ? session : undefined;
}

export function clearRealtimeSession() {
  latestView = undefined;
  saveStoredSession(undefined);
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

export function chooseRealtimeWind(wind: Wind) {
  return emitAck<Room>("room:choose-wind", wind);
}

export function updateRealtimeSettings(settings: RoomSettings) {
  return emitAck<Room>("room:update-settings", settings);
}

export function startRealtimeGame() {
  return emitAck<Room>("room:start");
}

export function readyRealtimeRound(round: number) {
  return emitAck<Room>("room:ready", round);
}

export function sendRealtimeChat(text: string) {
  return emitAck<void>("room:chat", text);
}

export function leaveRealtimeRoom() {
  return emitAck<void>("room:leave");
}

export function sendRealtimeAction(action: Parameters<ClientToServerEvents["game:action"]>[0]) {
  return emitAck<void>("game:action", action);
}
