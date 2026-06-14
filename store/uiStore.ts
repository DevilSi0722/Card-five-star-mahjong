"use client";

import { create } from "zustand";

const DISCARD_PHYSICS_KEY = "kwx:discardPhysicsEnabled";

function loadDiscardPhysicsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DISCARD_PHYSICS_KEY) === "1";
}

interface UiStore {
  // 当前鼠标悬浮的手牌 id（仅人类手牌），用于驱动底部听牌信息栏
  hoveredTileId?: string;
  // 已点击「亮倒」，等待用户双击一张可亮倒弃牌
  liangDaoArmed: boolean;
  // 是否使用物理碰撞弃牌显示。只影响本机画面，不同步到多人房间。
  discardPhysicsEnabled: boolean;
  setHoveredTileId: (id?: string) => void;
  setLiangDaoArmed: (armed: boolean) => void;
  setDiscardPhysicsEnabled: (enabled: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  hoveredTileId: undefined,
  liangDaoArmed: false,
  discardPhysicsEnabled: loadDiscardPhysicsEnabled(),
  setHoveredTileId: (id) => set((state) => (state.hoveredTileId === id ? state : { hoveredTileId: id })),
  setLiangDaoArmed: (armed) =>
    set((state) => (state.liangDaoArmed === armed ? state : { liangDaoArmed: armed })),
  setDiscardPhysicsEnabled: (enabled) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISCARD_PHYSICS_KEY, enabled ? "1" : "0");
    }
    set((state) => (state.discardPhysicsEnabled === enabled ? state : { discardPhysicsEnabled: enabled }));
  },
}));
