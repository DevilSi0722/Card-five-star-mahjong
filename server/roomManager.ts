import { randomBytes } from "node:crypto";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Server, Socket } from "socket.io";
import { createGameStore, type GameStore } from "@/store/gameStore";
import { cropSnapshotForSeat } from "@/lib/multiplayer/seatRotation";
import { engineSeatForClient, engineSeatWinds, resolveEngineSeats } from "@/lib/multiplayer/windSeating";
import { actionDelay } from "@/utils/mahjong/rules";
import { actionContext, compactView, syncPacket, SYNC_PROTOCOL, type CompactView } from "@/lib/multiplayer/syncProtocol";
import { chooseDiscard, chooseGang, chooseReaction, shouldDeclareLiangDao } from "@/utils/mahjong/ai";
import { analyzeWin } from "@/utils/mahjong/handAnalyzer";
import type {
  EngineSeatId,
  GuestActionInput,
  NetGameSnapshot,
  QuickChatMessage,
  Room,
  RoomPlayer,
  RoomSettings,
  Wind,
} from "@/types/multiplayer";
import { WIND_DISPLAY_ORDER } from "@/types/multiplayer";
import type {
  ClientToServerEvents,
  CreateRoomRequest,
  JoinRoomRequest,
  RealtimeResult,
  RealtimeSession,
  ServerToClientEvents,
  SocketData,
  ActionReceipt,
  RealtimeAction,
} from "@/types/realtime";

type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const ROOM_CODE = /^\d{4}$/;
const EMPTY_ROOM_GRACE_MS = 30 * 60_000;
const ACTION_HISTORY_LIMIT = 512;

interface RealtimeMetrics {
  fullPackets: number;
  patchPackets: number;
  bytesSent: number;
  fullViewBytes: number;
  actionsApplied: number;
  actionsRetried: number;
  actionsRejected: number;
}

function now() {
  return Date.now();
}

function roomChannel(code: string) {
  return `room:${code}`;
}

function newToken() {
  return randomBytes(24).toString("base64url");
}

function errorResult<T>(error: string): RealtimeResult<T> {
  return { ok: false, error };
}

function ok<T>(data: T): RealtimeResult<T> {
  return { ok: true, data };
}

function cloneRoom(room: Room): Room {
  return structuredClone(room);
}

function snapshotOf(state: GameStore): NetGameSnapshot {
  return {
    players: state.players,
    deadWall: state.deadWall,
    currentPlayerId: state.currentPlayerId,
    dealerId: state.dealerId,
    phase: state.phase,
    dealRevealCounts: state.dealRevealCounts,
    lastDiscard: state.lastDiscard,
    pendingReactions: state.pendingReactions,
    reactionPasses: state.reactionPasses,
    pendingBuGang: state.pendingBuGang,
    roundResult: state.roundResult,
    roundStartScores: state.roundStartScores,
    roundScoreNotes: state.roundScoreNotes,
    actionAnnouncement: state.actionAnnouncement,
    logs: state.logs,
    actionNonce: state.actionNonce,
    supplementContext: state.supplementContext,
    gangCount: state.gangCount,
    baseScore: state.baseScore,
    maxWinMultiplier: state.maxWinMultiplier,
    liangDaoZimoBuyHorseEnabled: state.liangDaoZimoBuyHorseEnabled,
    wall: state.wall,
  };
}

class ManagedRoom {
  private readonly engine: StoreApi<GameStore>;
  private readonly sessionTokens = new Map<string, string>();
  private readonly socketsByClient = new Map<string, Set<string>>();
  private aiTimer: ReturnType<typeof setTimeout> | undefined;
  private emptyTimer: ReturnType<typeof setTimeout> | undefined;
  private revision = 0;
  private destroyed = false;
  private viewsPending = false;
  private readonly baselines = new Map<string, CompactView>();
  private readonly actionHistory = new Map<string, Map<string, { request: string; result: RealtimeResult<ActionReceipt> }>>();

  constructor(
    private readonly io: RealtimeServer,
    private room: Room,
    hostToken: string,
    private readonly onDestroy: (code: string) => void,
    private readonly metrics: RealtimeMetrics,
  ) {
    this.sessionTokens.set(room.hostClientId, hostToken);
    this.engine = createStore(createGameStore);
    this.engine.subscribe(() => {
      if (this.room.status !== "playing" || this.destroyed) return;
      if (this.viewsPending) return;
      this.viewsPending = true;
      queueMicrotask(() => this.flushViews());
    });
  }

  get code() {
    return this.room.code;
  }

  get snapshot() {
    return cloneRoom(this.room);
  }

  get cursor() { return { roomCode: this.room.code, round: this.room.currentRound, rev: this.revision }; }

  attach(socket: RealtimeSocket, clientId: string) {
    this.clearEmptyTimer();
    socket.join(roomChannel(this.room.code));
    socket.data.identity = {
      clientId,
      code: this.room.code,
      sessionToken: this.sessionTokens.get(clientId)!,
    };
    const socketIds = this.socketsByClient.get(clientId) ?? new Set<string>();
    socketIds.add(socket.id);
    this.socketsByClient.set(clientId, socketIds);
    socket.emit("room:update", this.snapshot);
    this.emitViewFor(clientId);
  }

  detach(socket: RealtimeSocket) {
    const identity = socket.data.identity;
    if (!identity || identity.code !== this.room.code) return;
    const socketIds = this.socketsByClient.get(identity.clientId);
    socketIds?.delete(socket.id);
    this.baselines.delete(socket.id);
    if (socketIds?.size === 0) this.socketsByClient.delete(identity.clientId);
    if (this.socketsByClient.size === 0) this.scheduleEmptyRoomCleanup();
  }

  isSessionValid(clientId: string, sessionToken: string | undefined) {
    return Boolean(sessionToken && this.sessionTokens.get(clientId) === sessionToken);
  }

  createSession(clientId: string) {
    const sessionToken = newToken();
    this.sessionTokens.set(clientId, sessionToken);
    return sessionToken;
  }

  join(request: JoinRoomRequest): RealtimeResult<RealtimeSession> {
    const existing = this.room.players.find((player) => player.clientId === request.clientId);
    if (existing) {
      if (this.isSessionValid(request.clientId, request.sessionToken)) {
        existing.lastSeen = now();
        this.touch();
        return ok({ room: this.snapshot, myWind: existing.wind, sessionToken: request.sessionToken! });
      }
      if ((this.socketsByClient.get(request.clientId)?.size ?? 0) > 0) {
        return errorResult("该座位正在使用中，请使用原设备重连");
      }
      if (existing.name.trim() !== this.playerName(request.name)) {
        return errorResult("该座位已被保留，请使用原设备重连");
      }
      const token = this.createSession(request.clientId);
      existing.lastSeen = now();
      this.touch();
      return ok({ room: this.snapshot, myWind: existing.wind, sessionToken: token });
    }

    // 兼容旧版的按昵称重连：只允许接管已经断线的真人座位，防止在线玩家被同名者顶替。
    const reconnectingPlayer = this.room.players.find(
      (player) => !player.isAi && player.name.trim() === this.playerName(request.name),
    );
    if (reconnectingPlayer) {
      if ((this.socketsByClient.get(reconnectingPlayer.clientId)?.size ?? 0) > 0) {
        return errorResult("该昵称对应的玩家仍在线，请使用原设备重连");
      }
      const oldClientId = reconnectingPlayer.clientId;
      reconnectingPlayer.clientId = request.clientId;
      reconnectingPlayer.name = this.playerName(request.name);
      reconnectingPlayer.lastSeen = now();
      this.sessionTokens.delete(oldClientId);
      const token = this.createSession(request.clientId);
      if (this.room.hostClientId === oldClientId) this.room.hostClientId = request.clientId;
      if (this.room.readyClients) {
        this.room.readyClients = this.room.readyClients.map((clientId) =>
          clientId === oldClientId ? request.clientId : clientId,
        );
      }
      this.touch();
      return ok({ room: this.snapshot, myWind: reconnectingPlayer.wind, sessionToken: token });
    }

    if (this.room.status !== "waiting") return errorResult("该房间已开始游戏，只能原玩家重连");
    if (this.room.players.length >= 3) return errorResult("房间已满");
    const wind = WIND_DISPLAY_ORDER.find((candidate) => !this.room.players.some((player) => player.wind === candidate));
    if (!wind) return errorResult("房间已满");
    const token = this.createSession(request.clientId);
    this.room.players.push({
      clientId: request.clientId,
      name: this.playerName(request.name),
      wind,
      isHost: false,
      isAi: false,
      joinedAt: now(),
      lastSeen: now(),
    });
    this.touch();
    return ok({ room: this.snapshot, myWind: wind, sessionToken: token });
  }

  chooseWind(clientId: string, wind: Wind): RealtimeResult<Room> {
    if (this.room.status !== "waiting") return errorResult("游戏已开始，无法切换风位");
    const player = this.room.players.find((item) => item.clientId === clientId);
    if (!player) return errorResult("你不在该房间内");
    if (this.room.players.some((item) => item.clientId !== clientId && item.wind === wind)) {
      return errorResult("该风位已被占用");
    }
    player.wind = wind;
    player.lastSeen = now();
    this.touch();
    return ok(this.snapshot);
  }

  updateSettings(clientId: string, settings: RoomSettings): RealtimeResult<Room> {
    if (clientId !== this.room.hostClientId) return errorResult("只有房主可以修改设置");
    if (this.room.status !== "waiting") return errorResult("游戏已开始，无法修改设置");
    this.room.settings = {
      rounds: settings.rounds,
      baseScore: Math.max(1, Math.floor(settings.baseScore)),
      maxWinMultiplier: settings.maxWinMultiplier,
      liangDaoZimoBuyHorse: Boolean(settings.liangDaoZimoBuyHorse),
    };
    this.touch();
    return ok(this.snapshot);
  }

  start(clientId: string): RealtimeResult<Room> {
    if (clientId !== this.room.hostClientId) return errorResult("只有房主可以开始游戏");
    if (this.room.status !== "waiting") return errorResult("游戏已经开始");
    if (this.room.players.filter((player) => !player.isAi).length < 2) {
      return errorResult("至少需要 2 名真人玩家才能开始");
    }

    while (this.room.players.length < 3) {
      const wind = WIND_DISPLAY_ORDER.find((candidate) => !this.room.players.some((player) => player.wind === candidate));
      if (!wind) return errorResult("风位分配异常，无法开始");
      this.room.players.push({
        clientId: `ai:${wind}`,
        name: "电脑",
        wind,
        isHost: false,
        isAi: true,
        joinedAt: now(),
        lastSeen: now(),
      });
    }

    const seats = resolveEngineSeats(this.room.players);
    if (!seats) return errorResult("风位分配异常，无法开始");
    const roster = Object.fromEntries(
      (Object.keys(seats) as EngineSeatId[]).map((seat) => [seat, { name: seats[seat].name, isAi: seats[seat].isAi }]),
    );
    this.room.status = "playing";
    this.room.currentRound = 1;
    this.room.readyClients = [];
    this.touch(false);
    this.engine.getState().configureNet({ role: "host", seat: "human" });
    this.engine.getState().applyNetRoster(roster);
    this.engine.getState().saveNextRoundSettings({
      baseScore: this.room.settings.baseScore,
      maxWinMultiplier: this.room.settings.maxWinMultiplier,
      liangDaoZimoBuyHorseEnabled: this.room.settings.liangDaoZimoBuyHorse,
    });
    this.engine.getState().startNewRound();
    this.emitRoom();
    return ok(this.snapshot);
  }

  ready(clientId: string, round: number): RealtimeResult<Room> {
    if (this.room.status !== "playing" || this.room.currentRound !== round) return ok(this.snapshot);
    if (!this.room.players.some((player) => player.clientId === clientId && !player.isAi)) {
      return errorResult("你不在该房间内");
    }
    if (this.engine.getState().phase !== "settled" && this.engine.getState().phase !== "draw") return ok(this.snapshot);
    const ready = new Set(this.room.readyClients ?? []);
    ready.add(clientId);
    this.room.readyClients = Array.from(ready);
    const humans = this.room.players.filter((player) => !player.isAi);
    const reachedLimit = this.room.settings.rounds !== null && this.room.currentRound >= this.room.settings.rounds;
    if (!reachedLimit && humans.every((player) => ready.has(player.clientId))) {
      this.room.currentRound += 1;
      this.room.readyClients = [];
      this.engine.getState().startNewRound();
    }
    this.touch();
    return ok(this.snapshot);
  }

  chat(clientId: string, text: string): RealtimeResult<void> {
    const player = this.room.players.find((item) => item.clientId === clientId);
    const trimmed = text.trim().slice(0, 36);
    if (!player || !trimmed || this.room.status !== "playing") return errorResult("无法发送快捷聊天");
    const quickChat: QuickChatMessage = {
      id: `qc_${now()}_${Math.random().toString(36).slice(2, 7)}`,
      clientId,
      playerName: player.name,
      text: trimmed,
      createdAt: now(),
    };
    this.room.quickChat = quickChat;
    this.touch();
    return ok(undefined);
  }

  leave(socket: RealtimeSocket): RealtimeResult<void> {
    const clientId = socket.data.identity?.clientId;
    if (!clientId) return errorResult("请先加入房间");
    const isHost = clientId === this.room.hostClientId;
    this.detach(socket);
    socket.leave(roomChannel(this.room.code));
    socket.data.identity = undefined;

    if (isHost) {
      this.close("房主已解散房间");
      return ok(undefined);
    }

    // 对局中保留玩家与令牌，使断线或主动退出后仍可恢复同一座位。
    if (this.room.status === "playing") {
      const player = this.room.players.find((item) => item.clientId === clientId);
      if (player) player.lastSeen = now();
      this.touch();
      return ok(undefined);
    }

    this.room.players = this.room.players.filter((player) => player.clientId !== clientId);
    this.sessionTokens.delete(clientId);
    this.touch();
    return ok(undefined);
  }

  action(clientId: string, action: RealtimeAction): RealtimeResult<ActionReceipt> {
    const reject = (message: string): RealtimeResult<ActionReceipt> => {
      this.metrics.actionsRejected += 1;
      this.resync(clientId);
      return errorResult(message);
    };
    const request = JSON.stringify(action);
    const history = this.actionHistory.get(clientId) ?? new Map();
    const prior = action.actionId ? history.get(action.actionId) : undefined;
    if (prior) {
      if (prior.request !== request) return reject("操作编号已被使用，请重新操作");
      this.metrics.actionsRetried += 1;
      this.resync(clientId);
      return prior.result;
    }
    let result: RealtimeResult<ActionReceipt>;
    if (this.room.status !== "playing") result = reject("游戏尚未开始");
    else if (action.actionId && (action.round !== this.room.currentRound
      || action.context !== actionContext(this.engine.getState(), this.room.currentRound))) {
      result = reject("牌局已更新，已同步最新状态，请重新操作");
    } else if (!this.applyAction(clientId, action)) {
      result = reject("当前操作不符合牌局规则，已同步最新状态");
    } else {
      this.flushViews();
      this.metrics.actionsApplied += 1;
      result = ok({ actionId: action.actionId, round: this.room.currentRound, rev: this.revision });
    }
    if (action.actionId) {
      history.set(action.actionId, { request, result });
      if (history.size > ACTION_HISTORY_LIMIT) history.delete(history.keys().next().value!);
      this.actionHistory.set(clientId, history);
    }
    return result;
  }

  resync(clientId: string) {
    this.flushViews();
    this.emitViewFor(clientId);
  }

  private applyAction(clientId: string, action: Omit<GuestActionInput, "seat">): boolean {
    const seat = engineSeatForClient(this.room.players, clientId);
    if (!seat) return false;
    const game = this.engine.getState();
    if (action.type === "pass") {
      if (game.phase === "responding") {
        if (!game.pendingReactions?.options.some((option) => option.playerId === seat)
          || game.reactionPasses.includes(seat)) return false;
      } else if (game.phase !== "playing" || game.currentPlayerId !== seat) return false;
    }
    switch (action.type) {
      case "discard":
        if (action.tileId) game.discardTile(seat, action.tileId);
        break;
      case "peng":
        game.claimPeng(seat);
        break;
      case "ming_gang":
        game.claimMingGang(seat);
        break;
      case "an_gang":
        if (action.tileKind) game.claimAnGang(seat, action.tileKind);
        break;
      case "bu_gang":
        if (action.meldId) game.claimBuGang(seat, action.meldId);
        break;
      case "liang_dao":
        if (action.tileId) game.declareLiangDao(seat, action.tileId);
        break;
      case "hu":
        game.claimHu(seat);
        break;
      case "pass":
        game.passReaction(seat);
        break;
      default:
        return false;
    }
    const updated = this.engine.getState();
    if (updated === game) return false;
    if (action.type === "discard" || action.type === "liang_dao") {
      return updated.phase === "settled"
        || !updated.players[seat].hand.some((tile) => tile.id === action.tileId);
    }
    return true;
  }

  close(message: string) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.baselines.clear();
    this.actionHistory.clear();
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.clearEmptyTimer();
    this.io.to(roomChannel(this.room.code)).emit("room:closed", message);
    for (const socketIds of this.socketsByClient.values()) {
      for (const id of socketIds) {
        const socket = this.io.sockets.sockets.get(id);
        if (socket) {
          socket.leave(roomChannel(this.room.code));
          socket.data.identity = undefined;
        }
      }
    }
    this.socketsByClient.clear();
    this.onDestroy(this.room.code);
  }

  private touch(emit = true) {
    this.room.updatedAt = now();
    if (emit) this.emitRoom();
  }

  private emitRoom() {
    this.io.to(roomChannel(this.room.code)).emit("room:update", this.snapshot);
  }

  private flushViews() {
    if (!this.viewsPending || this.destroyed) return;
    this.viewsPending = false;
    this.emitViews();
    this.scheduleAi();
  }

  private emitViews() {
    const winds = engineSeatWinds(this.room.players);
    if (!winds) return;
    const state = snapshotOf(this.engine.getState());
    this.revision += 1;
    for (const player of this.room.players) {
      if (player.isAi) continue;
      const seat = engineSeatForClient(this.room.players, player.clientId);
      if (!seat) continue;
      const view = {
        roomCode: this.room.code,
        actionContext: actionContext(state, this.room.currentRound),
        forSeat: seat,
        round: this.room.currentRound,
        rev: this.revision,
        state: cropSnapshotForSeat(state, seat),
        winds: rotateWinds(winds, seat),
      };
      this.emitView(player.clientId, view);
    }
  }

  private emitViewFor(clientId: string) {
    if (this.room.status !== "playing") return;
    const winds = engineSeatWinds(this.room.players);
    const seat = engineSeatForClient(this.room.players, clientId);
    if (!winds || !seat) return;
    const view = {
      roomCode: this.room.code,
      actionContext: actionContext(this.engine.getState(), this.room.currentRound),
      forSeat: seat,
      round: this.room.currentRound,
      rev: this.revision,
      state: cropSnapshotForSeat(snapshotOf(this.engine.getState()), seat),
      winds: rotateWinds(winds, seat),
    };
    this.emitView(clientId, view, true);
  }

  private emitView(clientId: string, view: Parameters<ServerToClientEvents["game:view"]>[0], full = false) {
    let compact: CompactView | undefined;
    for (const socketId of this.socketsByClient.get(clientId) ?? []) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) continue;
      this.metrics.fullViewBytes += Buffer.byteLength(JSON.stringify(view));
      if (socket.data.syncProtocol === SYNC_PROTOCOL) {
        compact ??= compactView(view);
        const packet = syncPacket(compact, full ? undefined : this.baselines.get(socketId));
        this.baselines.set(socketId, compact);
        this.metrics[packet.kind === "full" ? "fullPackets" : "patchPackets"] += 1;
        this.metrics.bytesSent += Buffer.byteLength(JSON.stringify(packet));
        socket.emit("game:sync", packet);
      } else {
        this.metrics.fullPackets += 1;
        this.metrics.bytesSent += Buffer.byteLength(JSON.stringify(view));
        socket.emit("game:view", view);
      }
    }
  }

  private scheduleAi() {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    const state = this.engine.getState();
    if (state.phase === "playing") {
      const player = state.players[state.currentPlayerId];
      if (player.type !== "ai" && !player.autoPlay) return;
      const nonce = state.actionNonce;
      this.aiTimer = setTimeout(() => {
        const latest = this.engine.getState();
        if (latest.actionNonce !== nonce || latest.phase !== "playing" || latest.currentPlayerId !== player.id) return;
        const current = latest.players[player.id];
        const winningTile = current.hand.find((tile) => tile.id === current.lastDrawnTileId);
        if (analyzeWin(current.hand, winningTile?.kind, current.melds).isWin) {
          latest.claimHu(player.id);
          return;
        }
        if (current.isLiangDao || current.autoPlay) {
          const gang = chooseGang(current, { requireDrawnTile: true });
          if (gang?.action === "an_gang" && gang.tileKind) return latest.claimAnGang(player.id, gang.tileKind);
          if (gang?.action === "bu_gang" && gang.meldId) return latest.claimBuGang(player.id, gang.meldId);
          const drawn = current.lastDrawnTileId ? current.hand.find((tile) => tile.id === current.lastDrawnTileId) : current.hand.at(-1);
          if (drawn) latest.discardTile(player.id, drawn.id);
          return;
        }
        const gang = chooseGang(current);
        if (gang?.action === "an_gang" && gang.tileKind) return latest.claimAnGang(player.id, gang.tileKind);
        if (gang?.action === "bu_gang" && gang.meldId) return latest.claimBuGang(player.id, gang.meldId);
        const liangDao = shouldDeclareLiangDao(current, latest.players);
        if (liangDao?.tileId) return latest.declareLiangDao(player.id, liangDao.tileId);
        const discard = chooseDiscard(current, latest.players);
        if (discard.action === "pass") return latest.settleNoSafeDiscard(player.id);
        if (discard.tileId) latest.discardTile(player.id, discard.tileId);
      }, actionDelay());
      return;
    }
    if (state.phase !== "responding" || !state.pendingReactions) return;
    const option = state.pendingReactions.options.find(
      (candidate) => !state.reactionPasses.includes(candidate.playerId) && state.players[candidate.playerId].type === "ai",
    );
    if (!option) return;
    const nonce = state.actionNonce;
    this.aiTimer = setTimeout(() => {
      const latest = this.engine.getState();
      const pending = latest.pendingReactions;
      if (latest.actionNonce !== nonce || latest.phase !== "responding" || !pending) return;
      const currentOption = pending.options.find((candidate) => candidate.playerId === option.playerId);
      if (!currentOption || latest.reactionPasses.includes(option.playerId)) return;
      const decision = chooseReaction(
        latest.players[option.playerId],
        pending.discard.tile,
        currentOption.canHu,
        currentOption.canGang,
        currentOption.canPeng,
      );
      if (decision.action === "hu") latest.claimHu(option.playerId);
      else if (decision.action === "ming_gang") latest.claimMingGang(option.playerId);
      else if (decision.action === "peng") latest.claimPeng(option.playerId);
      else latest.passReaction(option.playerId);
    }, actionDelay());
  }

  private scheduleEmptyRoomCleanup() {
    this.clearEmptyTimer();
    this.emptyTimer = setTimeout(() => this.close("房间长时间无人连接，已自动关闭"), EMPTY_ROOM_GRACE_MS);
  }

  private clearEmptyTimer() {
    if (this.emptyTimer) clearTimeout(this.emptyTimer);
    this.emptyTimer = undefined;
  }

  private playerName(name: string) {
    return name.trim().slice(0, 12) || "玩家";
  }
}

function rotateWinds(winds: Record<EngineSeatId, Wind>, seat: EngineSeatId) {
  const order: EngineSeatId[] = ["human", "ai_right", "ai_left"];
  const result = {} as Record<EngineSeatId, Wind>;
  for (const realSeat of order) {
    const displayIndex = (order.indexOf(realSeat) - order.indexOf(seat) + order.length) % order.length;
    result[order[displayIndex]] = winds[realSeat];
  }
  return result;
}

export class RoomManager {
  private readonly rooms = new Map<string, ManagedRoom>();
  readonly metrics: RealtimeMetrics = {
    fullPackets: 0, patchPackets: 0, bytesSent: 0, fullViewBytes: 0,
    actionsApplied: 0, actionsRetried: 0, actionsRejected: 0,
  };

  get roomCount() { return this.rooms.size; }

  constructor(private readonly io: RealtimeServer) {}

  create(socket: RealtimeSocket, request: CreateRoomRequest): RealtimeResult<RealtimeSession> {
    const code = request.code?.trim() || this.nextCode();
    if (!ROOM_CODE.test(code)) return errorResult("房间号必须是 4 位数字");
    if (this.rooms.has(code)) return errorResult("房间号已被占用，请换一个");
    const player: RoomPlayer = {
      clientId: request.clientId,
      name: request.name.trim().slice(0, 12) || "玩家",
      wind: "east",
      isHost: true,
      isAi: false,
      joinedAt: now(),
      lastSeen: now(),
    };
    const room: Room = {
      code,
      hostClientId: request.clientId,
      status: "waiting",
      settings: request.settings,
      players: [player],
      currentRound: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    const token = newToken();
    if (this.fromSocket(socket)) return errorResult("请先退出当前房间");
    const managed = new ManagedRoom(this.io, room, token, (closedCode) => this.rooms.delete(closedCode), this.metrics);
    this.rooms.set(code, managed);
    managed.attach(socket, request.clientId);
    return ok({ room: managed.snapshot, myWind: "east", sessionToken: token });
  }

  join(socket: RealtimeSocket, request: JoinRoomRequest): RealtimeResult<RealtimeSession> {
    const room = this.rooms.get(request.code.trim());
    if (!room) return errorResult("房间不存在或服务器已重启");
    const result = room.join(request);
    if (result.ok) {
      const previous = this.fromSocket(socket);
      if (previous && previous !== room) {
        previous.detach(socket);
        socket.leave(roomChannel(previous.code));
      }
      room.attach(socket, request.clientId);
    }
    return result;
  }

  fromSocket(socket: RealtimeSocket): ManagedRoom | undefined {
    const identity = socket.data.identity;
    const room = identity ? this.rooms.get(identity.code) : undefined;
    return room && room.isSessionValid(identity!.clientId, identity!.sessionToken) ? room : undefined;
  }

  disconnect(socket: RealtimeSocket) {
    this.fromSocket(socket)?.detach(socket);
  }

  leave(socket: RealtimeSocket): RealtimeResult<void> {
    const room = this.fromSocket(socket);
    return room ? room.leave(socket) : errorResult("请先加入房间");
  }

  private nextCode() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = String(1000 + Math.floor(Math.random() * 9000));
      if (!this.rooms.has(code)) return code;
    }
    throw new Error("房间号资源暂时不足，请稍后重试");
  }
}
