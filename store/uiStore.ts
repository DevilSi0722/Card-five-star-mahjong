"use client";

import { create } from "zustand";

interface UiStore {
  // 当前鼠标悬浮的手牌 id（仅人类手牌），用于驱动底部听牌信息栏
  hoveredTileId?: string;
  setHoveredTileId: (id?: string) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  hoveredTileId: undefined,
  setHoveredTileId: (id) => set((state) => (state.hoveredTileId === id ? state : { hoveredTileId: id })),
}));
