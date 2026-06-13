"use client";

import { create } from "zustand";
import type { Unsubscribe } from "firebase/firestore";
import type {
  EngineSeatId,
  GameMode,
  Room,
  RoomPlayer,
  RoomSettings,
} from "@/types/multiplayer";
import { DEFAULT_ROOM_SETTINGS } from "@/types/multiplayer";
import {
  createRoom,
  fetchRoom,
  joinRoom,
  leaveRoom,
  sendAction,
  subscribeRoom,
  updateRoomPlayers,
  updateRoomProgress,
  updateRoomSettings,
} from "@/lib/multiplayer/roomRepository";
import { useGameStore } from "@/store/gameStore";
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
  mySeat: EngineSeatId | null;
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
  fillWithAi: () => Promise<void>;
  startGame: () => Promise<void>;
  leave: () => Promise<void>;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  mode: "single",
  view: "home",
  singlePlaying: false,
  clientId: getClientId(),
  playerName: loadName(),
  room: null,
  mySeat: null,
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
        seat: "human",
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
      useGameStore.getState().configureNet({ role: "host", seat: "human" });
      get().unsubscribe?.();
      const unsub = subscribeRoom(roomCode, (next) => {
        if (!next) {
          set({ room: null, view: "home", error: "房间已关闭" });
          return;
        }
        set({ room: next });
      });
      set({ room, mySeat: "human", view: "room", unsubscribe: unsub });
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
      const seat = await joinRoom(roomCode, {
        clientId,
        name: playerName,
        isHost: false,
        isAi: false,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      });
      // 加入即配置为 guest 角色，确保游戏挂载前角色已就位（避免首帧误跑引擎）。
      useGameStore.getState().configureNet({
        role: "guest",
        seat,
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
      set({ room, mySeat: seat, view: "room", unsubscribe: unsub });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "加入房间失败" });
    } finally {
      set({ busy: false });
    }
  },

  changeSettings: async (settings) => {
    const { room, isHost } = get();
    if (!room || !isHost()) return;
    await updateRoomSettings(room.code, settings);
  },

  fillWithAi: async () => {
    const { room, isHost } = get();
    if (!room || !isHost()) return;
    const takenSeats = new Set(room.players.map((p) => p.seat));
    const freeSeat = (["human", "ai_right", "ai_left"] as EngineSeatId[]).find((s) => !takenSeats.has(s));
    if (!freeSeat) return;
    const aiNames: Record<EngineSeatId, string> = { human: "电脑", ai_right: "电脑右", ai_left: "电脑左" };
    const aiPlayer: RoomPlayer = {
      clientId: `ai:${freeSeat}`,
      name: aiNames[freeSeat],
      seat: freeSeat,
      isHost: false,
      isAi: true,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };
    await updateRoomPlayers(room.code, [...room.players, aiPlayer]);
  },

  startGame: async () => {
    const { room, isHost } = get();
    if (!room || !isHost()) return;
    set({ busy: true, error: null });
    try {
      // 至少两名真人即可开始；不足三人则用 AI 补满。
      const humans = room.players.filter((p) => !p.isAi);
      if (humans.length < 2) throw new Error("至少需要 2 名真人玩家才能开始");
      let players = room.players;
      const seats = new Set(players.map((p) => p.seat));
      const aiNames: Record<EngineSeatId, string> = { human: "电脑", ai_right: "电脑右", ai_left: "电脑左" };
      for (const seat of ["human", "ai_right", "ai_left"] as EngineSeatId[]) {
        if (!seats.has(seat)) {
          players = [
            ...players,
            {
              clientId: `ai:${seat}`,
              name: aiNames[seat],
              seat,
              isHost: false,
              isAi: true,
              joinedAt: Date.now(),
              lastSeen: Date.now(),
            },
          ];
        }
      }
      if (players !== room.players) await updateRoomPlayers(room.code, players);
      await updateRoomProgress(room.code, { status: "playing", currentRound: 1 });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "开始游戏失败" });
    } finally {
      set({ busy: false });
    }
  },

  leave: async () => {
    const { room, clientId, unsubscribe } = get();
    unsubscribe?.();
    if (room) await leaveRoom(room.code, clientId).catch(() => undefined);
    useGameStore.getState().configureNet({ role: "single", seat: "human" });
    set({ room: null, mySeat: null, view: "home", unsubscribe: null, error: null });
  },
}));
