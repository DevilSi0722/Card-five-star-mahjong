"use client";

import { create } from "zustand";

const DISCARD_PHYSICS_KEY = "kwx:discardPhysicsEnabled";
const TABLECLOTH_KEY = "kwx:tableclothId";
const TILE_BACK_KEY = "kwx:tileBackId";
const SOUND_ENABLED_KEY = "kwx:soundEnabled";
const HARDCORE_MODE_KEY = "kwx:hardcoreModeEnabled";

const TABLECLOTH_IDS = ["table", "table2", "table3", "table4", "table5", "table6"] as const;
const TILE_BACK_IDS = ["ink-cloud", "jade-phoenix", "cinnabar-bell", "black-gold-thunder"] as const;

export type TableclothId = (typeof TABLECLOTH_IDS)[number];
export type TileBackId = (typeof TILE_BACK_IDS)[number];

function loadDiscardPhysicsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DISCARD_PHYSICS_KEY) === "1";
}

function loadSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  // 默认开启音效；仅当用户明确关闭过才记为关闭。
  return window.localStorage.getItem(SOUND_ENABLED_KEY) !== "0";
}

function loadHardcoreModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(HARDCORE_MODE_KEY) === "1";
}

function isTableclothId(value: string | null): value is TableclothId {
  return TABLECLOTH_IDS.some((id) => id === value);
}

function loadTableclothId(): TableclothId {
  if (typeof window === "undefined") return "table";
  const value = window.localStorage.getItem(TABLECLOTH_KEY);
  return isTableclothId(value) ? value : "table";
}

function isTileBackId(value: string | null): value is TileBackId {
  return TILE_BACK_IDS.some((id) => id === value);
}

function loadTileBackId(): TileBackId {
  if (typeof window === "undefined") return "ink-cloud";
  const value = window.localStorage.getItem(TILE_BACK_KEY);
  return isTileBackId(value) ? value : "ink-cloud";
}

interface UiStore {
  // 当前鼠标悬浮的手牌 id（仅人类手牌），用于驱动底部听牌信息栏
  hoveredTileId?: string;
  // 已点击「亮倒」，等待用户双击一张可亮倒弃牌
  liangDaoArmed: boolean;
  // 是否使用物理碰撞弃牌显示。只影响本机画面，不同步到多人房间。
  discardPhysicsEnabled: boolean;
  // 本机桌布显示设置。只影响自己的画面，不同步到多人房间。
  tableclothId: TableclothId;
  // 本机牌背显示设置。只影响自己的画面，不同步到多人房间。
  tileBackId: TileBackId;
  // 音效开关。只影响本机，不同步到多人房间。
  soundEnabled: boolean;
  // 单人硬核模式：隐藏听牌辅助提示。只影响本机单人对局显示。
  hardcoreModeEnabled: boolean;
  setHoveredTileId: (id?: string) => void;
  setLiangDaoArmed: (armed: boolean) => void;
  setDiscardPhysicsEnabled: (enabled: boolean) => void;
  setTableclothId: (id: TableclothId) => void;
  setTileBackId: (id: TileBackId) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setHardcoreModeEnabled: (enabled: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  hoveredTileId: undefined,
  liangDaoArmed: false,
  discardPhysicsEnabled: loadDiscardPhysicsEnabled(),
  tableclothId: loadTableclothId(),
  tileBackId: loadTileBackId(),
  soundEnabled: loadSoundEnabled(),
  hardcoreModeEnabled: loadHardcoreModeEnabled(),
  setHoveredTileId: (id) => set((state) => (state.hoveredTileId === id ? state : { hoveredTileId: id })),
  setLiangDaoArmed: (armed) =>
    set((state) => (state.liangDaoArmed === armed ? state : { liangDaoArmed: armed })),
  setDiscardPhysicsEnabled: (enabled) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISCARD_PHYSICS_KEY, enabled ? "1" : "0");
    }
    set((state) => (state.discardPhysicsEnabled === enabled ? state : { discardPhysicsEnabled: enabled }));
  },
  setTableclothId: (id) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TABLECLOTH_KEY, id);
    }
    set((state) => (state.tableclothId === id ? state : { tableclothId: id }));
  },
  setTileBackId: (id) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TILE_BACK_KEY, id);
    }
    set((state) => (state.tileBackId === id ? state : { tileBackId: id }));
  },
  setSoundEnabled: (enabled) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SOUND_ENABLED_KEY, enabled ? "1" : "0");
    }
    set((state) => (state.soundEnabled === enabled ? state : { soundEnabled: enabled }));
  },
  setHardcoreModeEnabled: (enabled) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HARDCORE_MODE_KEY, enabled ? "1" : "0");
    }
    set((state) => (state.hardcoreModeEnabled === enabled ? state : { hardcoreModeEnabled: enabled }));
  },
}));
