"use client";

import { create } from "zustand";
import type { GameMode, GuestActionInput, Room, RoomSettings, Wind } from "@/types/multiplayer";
import {
  chooseRealtimeWind, clearRealtimeSession, createRealtimeRoom, joinRealtimeRoom,
  leaveRealtimeRoom, readyRealtimeRound, savedSessionFor, sendRealtimeAction,
  sendRealtimeChat, startRealtimeGame, subscribeRoom, subscribeRoomClosed,
  updateRealtimeSettings,
} from "@/lib/multiplayer/realtimeClient";
import { useGameStore } from "@/store/gameStore";

const CLIENT_ID_KEY = "kwx:clientId";
const NAME_KEY = "kwx:playerName";

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
  return typeof window === "undefined" ? "玩家" : window.localStorage.getItem(NAME_KEY) || "玩家";
}

type LobbyView = "home" | "multiplayer" | "create" | "join" | "room";
type RoomUnsubscribe = () => void;

interface RoomStore {
  mode: GameMode;
  view: LobbyView;
  singlePlaying: boolean;
  clientId: string;
  playerName: string;
  room: Room | null;
  myWind: Wind | null;
  error: string | null;
  busy: boolean;
  unsubscribe: RoomUnsubscribe | null;
  isHost: () => boolean;
  setMode: (mode: GameMode) => void;
  setView: (view: LobbyView) => void;
  setPlayerName: (name: string) => void;
  clearError: () => void;
  startSingle: () => void;
  backToHome: () => void;
  createNewRoom: (settings: RoomSettings, code?: string) => Promise<void>;
  joinExistingRoom: (code: string) => Promise<void>;
  changeSettings: (settings: RoomSettings) => Promise<void>;
  chooseWind: (wind: Wind) => Promise<void>;
  startGame: () => Promise<void>;
  markReady: (round: number) => Promise<void>;
  sendQuickChat: (text: string) => Promise<void>;
  leave: () => Promise<void>;
}

function configureRealtimeClient() {
  useGameStore.getState().configureNet({
    role: "guest",
    seat: "human",
    forward: (input: GuestActionInput) => {
      const { seat: _seat, ...action } = input;
      void sendRealtimeAction(action).catch((error) => {
        useRoomStore.setState({ error: error instanceof Error ? error.message : "游戏动作发送失败" });
      });
    },
  });
}

function bindRoomEvents(set: (partial: Partial<RoomStore>) => void, get: () => RoomStore) {
  get().unsubscribe?.();
  const stopRoom = subscribeRoom((room) => {
    const current = get().room;
    if (!current || current.code === room.code) set({ room });
  });
  const stopClosed = subscribeRoomClosed((message) => {
    get().unsubscribe?.();
    useGameStore.getState().configureNet({ role: "single", seat: "human" });
    set({ room: null, myWind: null, view: "home", error: message, unsubscribe: null });
  });
  return () => {
    stopRoom();
    stopClosed();
  };
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  mode: "single", view: "home", singlePlaying: false, clientId: getClientId(), playerName: loadName(),
  room: null, myWind: null, error: null, busy: false, unsubscribe: null,
  isHost: () => {
    const { room, clientId } = get();
    return Boolean(room && room.hostClientId === clientId);
  },
  setMode: (mode) => set({ mode }),
  setView: (view) => set({ view }),
  startSingle: () => {
    useGameStore.getState().configureNet({ role: "single", seat: "human" });
    set({ mode: "single", singlePlaying: true });
  },
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
      const roomCode = code?.trim();
      if (roomCode && !/^\d{4}$/.test(roomCode)) throw new Error("房间号必须是 4 位数字");
      clearRealtimeSession();
      const session = await createRealtimeRoom({ clientId, name: playerName, settings, code: roomCode || undefined });
      const unsubscribe = bindRoomEvents(set, get);
      configureRealtimeClient();
      set({ mode: "multiplayer", room: session.room, myWind: session.myWind, view: "room", unsubscribe });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "创建房间失败" });
    } finally { set({ busy: false }); }
  },
  joinExistingRoom: async (code) => {
    const { clientId, playerName } = get();
    set({ busy: true, error: null });
    try {
      const roomCode = code.trim();
      if (!/^\d{4}$/.test(roomCode)) throw new Error("房间号必须是 4 位数字");
      const prior = savedSessionFor(roomCode);
      const session = await joinRealtimeRoom({ clientId, name: playerName, code: roomCode, sessionToken: prior?.sessionToken });
      const unsubscribe = bindRoomEvents(set, get);
      configureRealtimeClient();
      set({ mode: "multiplayer", room: session.room, myWind: session.myWind, view: "room", unsubscribe });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "加入房间失败" });
    } finally { set({ busy: false }); }
  },
  chooseWind: async (wind) => {
    try { await chooseRealtimeWind(wind); set({ myWind: wind, error: null }); }
    catch (error) { set({ error: error instanceof Error ? error.message : "切换风位失败" }); }
  },
  changeSettings: async (settings) => {
    if (!get().isHost()) return;
    try { await updateRealtimeSettings(settings); }
    catch (error) { set({ error: error instanceof Error ? error.message : "更新设置失败" }); }
  },
  startGame: async () => {
    if (!get().isHost()) return;
    set({ busy: true, error: null });
    try { await startRealtimeGame(); }
    catch (error) { set({ error: error instanceof Error ? error.message : "开始游戏失败" }); }
    finally { set({ busy: false }); }
  },
  markReady: async (round) => {
    try { await readyRealtimeRound(round); }
    catch (error) { set({ error: error instanceof Error ? error.message : "准备失败" }); }
  },
  sendQuickChat: async (text) => {
    if (!get().room || !text.trim()) return;
    try { await sendRealtimeChat(text.trim().slice(0, 36)); }
    catch (error) { set({ error: error instanceof Error ? error.message : "快捷聊天发送失败" }); }
  },
  leave: async () => {
    const { room, unsubscribe } = get();
    set({ busy: true, error: null });
    try {
      if (room) await leaveRealtimeRoom();
      unsubscribe?.();
      clearRealtimeSession();
      useGameStore.getState().configureNet({ role: "single", seat: "human" });
      set({ mode: "single", room: null, myWind: null, view: "home", unsubscribe: null });
    } catch (error) { set({ error: error instanceof Error ? error.message : "离开房间失败" }); }
    finally { set({ busy: false }); }
  },
}));
