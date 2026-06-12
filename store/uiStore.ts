"use client";

import { create } from "zustand";

interface UiStore {
  // 当前鼠标悬浮的手牌 id（仅人类手牌），用于驱动底部听牌信息栏
  hoveredTileId?: string;
  // 已点击「亮倒」，等待用户双击一张可亮倒弃牌
  liangDaoArmed: boolean;
  setHoveredTileId: (id?: string) => void;
  setLiangDaoArmed: (armed: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  hoveredTileId: undefined,
  liangDaoArmed: false,
  setHoveredTileId: (id) => set((state) => (state.hoveredTileId === id ? state : { hoveredTileId: id })),
  setLiangDaoArmed: (armed) =>
    set((state) => (state.liangDaoArmed === armed ? state : { liangDaoArmed: armed })),
}));
