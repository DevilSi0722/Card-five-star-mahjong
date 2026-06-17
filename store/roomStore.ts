"use client";

import { create } from "zustand";
import type { Unsubscribe } from "firebase/firestore";
import type {
  GameMode,
  Room,
  RoomPlayer,
  RoomSettings,
  Wind,
} from "@/types/multiplayer";
import { DEFAULT_ROOM_SETTINGS, WIND_DISPLAY_ORDER } from "@/types/multiplayer";
import {
  chooseWind as chooseWindRepo,
  createRoom,
  fetchRoom,
  joinRoom,
  leaveRoom,
  markReady as markReadyRepo,
  sendAction,
  sendQuickChat as sendQuickChatRepo,
  subscribeRoom,
  updateRoomPlayers,
  updateRoomProgress,
  updateRoomSettings,
} from "@/lib/multiplayer/roomRepository";
import { useGameStore } from "@/store/gameStore";
import { engineSeatForClient, resolveEngineSeats } from "@/lib/multiplayer/windSeating";
import type { GuestActionInput, NetAction } from "@/types/multiplayer";

/** 构造一条发送给房主的网络动作。 */
const ACTION_SEQ_KEY = "kwx:lastNetActionSeq";
let netActionSeqSalt = 0;

function buildNetAction(input: GuestActionInput): NetAction {
  netActionSeqSalt = (netActionSeqSalt + 1) % 1000;
  const lastSeq =
    typeof window === "undefined"
      ? 0
      : Number.parseInt(window.localStorage.getItem(ACTION_SEQ_KEY) ?? "0", 10) || 0;
  const seq = Math.max(Date.now() * 1000 + netActionSeqSalt, lastSeq + 1);
  if (typeof window !== "undefined") window.localStorage.setItem(ACTION_SEQ_KEY, String(seq));
  return {
    id: `a_${seq}_${Math.random().toString(36).slice(2, 7)}`,
    seq,
    seat: input.seat,
    type: input.type,
    tileId: input.tileId,
    tileKind: input.tileKind,
    meldId: input.meldId,
    createdAt: Date.now(),
  };
}

const CLIENT_ID_KEY = "kwx:clientId";
const NAME_KEY = "kwx:playerName";

/** 取得/生成持久化的客户端唯一标识。 */
function getClientId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = `c_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    window.localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

function loadName(): string {
  if (typeof window === "undefined") return "玩家";
  return window.localStorage.getItem(NAME_KEY) || "玩家";
}

/** 生成 4 位房间号（1000–9999）。 */
function randomCode(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

function isRoomOccupiedError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("房间号已被占用");
}

type LobbyView = "home" | "multiplayer" | "create" | "join" | "room";

interface RoomStore {
  mode: GameMode;
  view: LobbyView;
  /** 单人模式是否已开局（用于入口路由）。 */
  singlePlaying: boolean;
  clientId: string;
  playerName: string;
  room: Room | null;
  /** 本客户端选择的风位。 */
  myWind: Wind | null;
  error: string | null;
  busy: boolean;
  unsubscribe: Unsubscribe | null;

  isHost: () => boolean;
  setMode: (mode: GameMode) => void;
  setView: (view: LobbyView) => void;
  setPlayerName: (name: string) => void;
  clearError: () => void;
  /** 进入单人模式对局。 */
  startSingle: () => void;
  /** 退回大厅首页（单人模式结束 / 多人离开后）。 */
  backToHome: () => void;

  createNewRoom: (settings: RoomSettings, code?: string) => Promise<void>;
  joinExistingRoom: (code: string) => Promise<void>;
  changeSettings: (settings: RoomSettings) => Promise<void>;
  /** 切换自己的风位（等候室、目标空闲时）。 */
  chooseWind: (wind: Wind) => Promise<void>;
  startGame: () => Promise<void>;
  /** 本局结算后点「准备」，等待全员就绪。 */
  markReady: () => Promise<void>;
  /** 多人局内发送一条快捷聊天。 */
  sendQuickChat: (text: string) => Promise<void>;
  leave: () => Promise<void>;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  mode: "single",
  view: "home",
  singlePlaying: false,
  clientId: getClientId(),
  playerName: loadName(),
  room: null,
  myWind: null,
  error: null,
  busy: false,
  unsubscribe: null,

  isHost: () => {
    const { room, clientId } = get();
    return Boolean(room && room.hostClientId === clientId);
  },

  setMode: (mode) => set({ mode }),
  setView: (view) => set({ view }),
  startSingle: () => set({ mode: "single", singlePlaying: true }),
  backToHome: () => set({ mode: "single", singlePlaying: false, view: "home" }),
  setPlayerName: (name) => {
    const trimmed = name.slice(0, 12);
    if (typeof window !== "undefined") window.localStorage.setItem(NAME_KEY, trimmed);
    set({ playerName: trimmed });
  },
  clearError: () => set({ error: null }),

  createNewRoom: async (settings, code) => {
    const { clientId, playerName } = get();
    set({ busy: true, error: null });
    try {
      const host: RoomPlayer = {
        clientId,
        name: playerName,
        wind: "east",
        isHost: true,
        isAi: false,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      };
      const manualCode = code?.trim();
      if (manualCode && !/^\d{4}$/.test(manualCode)) throw new Error("房间号必须是 4 位数字");
      let room: Room | null = null;
      const attempts = manualCode ? [manualCode] : Array.from({ length: 12 }, () => randomCode());
      let lastError: unknown;
      for (const roomCode of attempts) {
        const candidate: Room = {
          code: roomCode,
          hostClientId: clientId,
          status: "waiting",
          settings,
          players: [host],
          currentRound: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        try {
          await createRoom(candidate);
          room = candidate;
          break;
        } catch (err) {
          lastError = err;
          if (manualCode || !isRoomOccupiedError(err)) throw err;
        }
      }
      if (!room) throw lastError instanceof Error ? lastError : new Error("创建房间失败，请重试");
      // 房主恒为引擎 human 座位。
      useGameStore.getState().configureNet({ role: "host", seat: "human" });
      get().unsubscribe?.();
      const unsub = subscribeRoom(room.code, (next) => {
        if (!next) {
          set({ room: null, view: "home", error: "房间已关闭" });
          return;
        }
        set({ room: next });
      });
      set({ room, myWind: "east", view: "room", unsubscribe: unsub });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "创建房间失败" });
    } finally {
      set({ busy: false });
    }
  },

  joinExistingRoom: async (code) => {
    const { clientId, playerName } = get();
    set({ busy: true, error: null });
    try {
      const roomCode = code.trim();
      if (!/^\d{4}$/.test(roomCode)) throw new Error("房间号必须是 4 位数字");
      const wind = await joinRoom(roomCode, {
        clientId,
        name: playerName,
        isHost: false,
        isAi: false,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      });
      get().unsubscribe?.();
      const unsub = subscribeRoom(roomCode, (next) => {
        if (!next) {
          set({ room: null, view: "home", error: "房主已解散房间" });
          get().unsubscribe?.();
          set({ unsubscribe: null });
          return;
        }
        set({ room: next });
      });
      const room = await fetchRoom(roomCode);
      const reconnectingAsHost = room?.hostClientId === clientId;
      // 加入/重连时先配置网络身份。guest 的真实座位会在桥接层按风位再次校正。
      useGameStore.getState().configureNet(
        reconnectingAsHost
          ? { role: "host", seat: "human" }
          : {
              role: "guest",
              seat: "ai_right",
              forward: (input: GuestActionInput) => {
                const current = get();
                const seat = current.room
                  ? (engineSeatForClient(current.room.players, current.clientId) ?? input.seat)
                  : input.seat;
                void sendAction(roomCode, buildNetAction({ ...input, seat }));
              },
            },
      );
      set({ room, myWind: wind, view: "room", unsubscribe: unsub });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "加入房间失败" });
    } finally {
      set({ busy: false });
    }
  },

  chooseWind: async (wind) => {
    const { room, clientId } = get();
    if (!room) return;
    set({ error: null });
    try {
      await chooseWindRepo(room.code, clientId, wind);
      set({ myWind: wind });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "切换风位失败" });
    }
  },

  changeSettings: async (settings) => {
    const { room, isHost } = get();
    if (!room || !isHost()) return;
    await updateRoomSettings(room.code, settings);
  },

  startGame: async () => {
    const { room, isHost } = get();
    if (!room || !isHost()) return;
    set({ busy: true, error: null });
    try {
      // 至少两名真人即可开始；不足三人则用 AI 补满空闲风位。
      const humans = room.players.filter((p) => !p.isAi);
      if (humans.length < 2) throw new Error("至少需要 2 名真人玩家才能开始");

      let players = room.players;
      if (players.length < 3) {
        const takenWinds = new Set(players.map((p) => p.wind));
        const freeWind = WIND_DISPLAY_ORDER.find((w) => !takenWinds.has(w));
        if (freeWind) {
          players = [
            ...players,
            {
              clientId: `ai:${freeWind}`,
              name: "电脑",
              wind: freeWind,
              isHost: false,
              isAi: true,
              joinedAt: Date.now(),
              lastSeen: Date.now(),
            },
          ];
        }
      }

      // 校验三名玩家的风位能推导出引擎座位（房主在场、恰好三人）。
      if (!resolveEngineSeats(players)) throw new Error("风位分配异常，无法开始");

      if (players !== room.players) await updateRoomPlayers(room.code, players);
      await updateRoomProgress(room.code, { status: "playing", currentRound: 1 });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "开始游戏失败" });
    } finally {
      set({ busy: false });
    }
  },

  markReady: async () => {
    const { room, clientId } = get();
    if (!room) return;
    await markReadyRepo(room.code, clientId).catch(() => undefined);
  },

  sendQuickChat: async (text) => {
    const { room, clientId, playerName } = get();
    if (!room || room.status !== "playing") return;
    const trimmed = text.trim().slice(0, 36);
    if (!trimmed) return;
    const roomPlayerName = room.players.find((player) => player.clientId === clientId)?.name;
    const message = {
      id: `qc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clientId,
      playerName: roomPlayerName || playerName || "玩家",
      text: trimmed,
      createdAt: Date.now(),
    };
    set((state) => (state.room?.code === room.code ? { room: { ...state.room, quickChat: message } } : {}));
    await sendQuickChatRepo(room.code, message).catch((err) => {
      set({ error: err instanceof Error ? err.message : "快捷聊天发送失败" });
    });
  },

  leave: async () => {
    const { room, clientId, unsubscribe } = get();
    set({ busy: true, error: null });
    try {
      if (room) await leaveRoom(room.code, clientId);
      unsubscribe?.();
      useGameStore.getState().configureNet({ role: "single", seat: "human" });
      set({ room: null, myWind: null, view: "home", unsubscribe: null, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "离开房间失败" });
    } finally {
      set({ busy: false });
    }
  },
}));
