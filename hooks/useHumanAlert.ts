"use client";

import { useGameStore } from "@/store/gameStore";
import { analyzeWin, getAnGangKinds, getTingDiscardOptions } from "@/utils/mahjong/handAnalyzer";

/**
 * 玩家当前可执行的最高优先级动作，用于驱动四周氛围灯。
 * 优先级：可胡 > 可碰/杠 > 可亮倒 > 轮到出牌。
 */
export type HumanAlert = "hu" | "meld" | "liangdao" | "turn" | null;

export function useHumanAlert(): HumanAlert {
  const players = useGameStore((state) => state.players);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const phase = useGameStore((state) => state.phase);
  const pendingReactions = useGameStore((state) => state.pendingReactions);
  const reactionPasses = useGameStore((state) => state.reactionPasses);

  const human = players.human;

  // 响应阶段：仅当“人类”是当前最高优先级的响应方时，其按钮才可用（与 ActionPanel 一致）
  const topReaction =
    phase === "responding" && pendingReactions
      ? pendingReactions.options.find((option) => !reactionPasses.includes(option.playerId) && option.canHu) ??
        pendingReactions.options.find((option) => !reactionPasses.includes(option.playerId) && option.canGang) ??
        pendingReactions.options.find((option) => !reactionPasses.includes(option.playerId) && option.canPeng)
      : undefined;
  const humanReaction =
    topReaction?.playerId === "human"
      ? pendingReactions?.options.find((option) => option.playerId === "human")
      : undefined;

  // 自摸按钮在亮倒托管后仍由玩家手动点击，因此可自摸时也需要触发胡牌氛围灯。
  const isHumanTurn = phase === "playing" && currentPlayerId === "human";
  const playable = isHumanTurn && !human.autoPlay;
  const drawn = isHumanTurn ? human.hand.find((tile) => tile.id === human.lastDrawnTileId) : undefined;
  const canSelfHu = isHumanTurn ? analyzeWin(human.hand, drawn?.kind, human.melds).isWin : false;
  const anGangKinds = playable ? getAnGangKinds(human.hand) : [];
  const buGangMelds = playable
    ? human.melds.filter(
        (meld) => meld.type === "peng" && human.hand.some((tile) => tile.kind === meld.tiles[0].kind),
      )
    : [];
  const tingOptions = playable ? getTingDiscardOptions(human.hand, human.melds) : [];

  if (humanReaction?.canHu || canSelfHu) return "hu";
  if (humanReaction?.canPeng || humanReaction?.canGang || anGangKinds.length > 0 || buGangMelds.length > 0) {
    return "meld";
  }
  if (tingOptions.length > 0) return "liangdao";
  if (playable) return "turn";
  return null;
}
