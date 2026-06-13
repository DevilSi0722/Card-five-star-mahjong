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
  subscribeRoom,
  updateRoomPlayers,
  updateRoomProgress,
  updateRoomSettings,
} from "@/lib/multiplayer/roomRepository";
import { useGameStore } from "@/store/gameStore";
import { resolveEngineSeats } from "@/lib/multiplayer/windSeating";
import type { GuestActionInput, NetAction } from "@/types/multiplayer";

/** 构造一条发送给房主的网络动作。 */
function buildNetAction(input: GuestActionInput): NetAction {
  return {
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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

type LobbyView = "home" | "create" | "join" | "room";

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
      const roomCode = code?.trim() || randomCode();
      if (!/^\d{4}$/.test(roomCode)) throw new Error("房间号必须是 4 位数字");
      const host: RoomPlayer = {
        clientId,
        name: playerName,
        wind: "east",
        isHost: true,
        isAi: false,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      };
      const room: Room = {
        code: roomCode,
        hostClientId: clientId,
        status: "waiting",
        settings,
        players: [host],
        currentRound: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await createRoom(room);
      // 房主恒为引擎 human 座位。
      useGameStore.getState().configureNet({ role: "host", seat: "human" });
      get().unsubscribe?.();
      const unsub = subscribeRoom(roomCode, (next) => {
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
      // 加入即配置为 guest 角色（先用占位座位，真正引擎座位在三人就座后由桥接层按风位推导校正），
      // 确保游戏挂载前角色已就位，避免首帧误跑引擎。
      useGameStore.getState().configureNet({
        role: "guest",
        seat: "ai_right",
        forward: (input: GuestActionInput) => {
          void sendAction(roomCode, buildNetAction(input));
        },
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

  leave: async () => {
    const { room, clientId, unsubscribe } = get();
    unsubscribe?.();
    if (room) await leaveRoom(room.code, clientId).catch(() => undefined);
    useGameStore.getState().configureNet({ role: "single", seat: "human" });
    set({ room: null, myWind: null, view: "home", unsubscribe: null, error: null });
  },
}));
