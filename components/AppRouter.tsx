"use client";

import { useRoomStore } from "@/store/roomStore";
import { Lobby } from "@/components/lobby/Lobby";
import { MahjongGame } from "@/components/game/MahjongGame";

/**
 * 入口路由：
 * - 单人模式已开局 → 直接进入游戏（与原单机体验完全一致）。
 * - 多人模式且房间已开始 → 进入游戏（联机由 useNetBridge 桥接）。
 * - 其余情况 → 大厅（模式选择 / 创建 / 加入 / 等待室）。
 */
export function AppRouter() {
  const singlePlaying = useRoomStore((s) => s.singlePlaying);
  const room = useRoomStore((s) => s.room);
  const startSingle = useRoomStore((s) => s.startSingle);

  const inMultiplayerGame = Boolean(room && room.status === "playing");

  if (singlePlaying || inMultiplayerGame) {
    return <MahjongGame />;
  }

  return <Lobby onStartSingle={startSingle} />;
}
