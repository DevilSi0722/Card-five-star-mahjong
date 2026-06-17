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

  // 响应阶段：胡牌可多人同时成立；碰/杠仍只在“人类”是当前最高优先级响应方时提示。
  const remainingReactions =
    phase === "responding" && pendingReactions
      ? pendingReactions.options.filter((option) => !reactionPasses.includes(option.playerId))
      : [];
  const humanPendingReaction = remainingReactions.find((option) => option.playerId === "human");
  const hasHuPriority = remainingReactions.some((option) => option.canHu);
  const topNonHuReaction =
    remainingReactions.find((option) => option.canGang) ?? remainingReactions.find((option) => option.canPeng);
  const humanReaction = humanPendingReaction?.canHu
    ? humanPendingReaction
    : !hasHuPriority && topNonHuReaction?.playerId === "human"
      ? humanPendingReaction
      : undefined;

  // 自摸按钮在亮倒托管后仍由玩家手动点击，因此可自摸时也需要触发胡牌氛围灯。
  const isHumanTurn = phase === "playing" && currentPlayerId === "human";
  const playable = isHumanTurn && !human.autoPlay;
  const liangDaoDecisionTurn = isHumanTurn && human.isLiangDao;
  const drawn = isHumanTurn ? human.hand.find((tile) => tile.id === human.lastDrawnTileId) : undefined;
  const canSelfHu = isHumanTurn ? analyzeWin(human.hand, drawn?.kind, human.melds).isWin : false;
  const anGangKinds = playable || liangDaoDecisionTurn ? getAnGangKinds(human.hand) : [];
  const buGangMelds = playable || liangDaoDecisionTurn
    ? human.melds.filter(
        (meld) => meld.type === "peng" && human.hand.some((tile) => tile.kind === meld.tiles[0].kind),
      )
    : [];
  const turnAnGangKinds = liangDaoDecisionTurn && drawn
    ? anGangKinds.filter((kind) => kind === drawn.kind)
    : anGangKinds;
  const turnBuGangMelds = buGangMelds;
  const tingOptions = playable ? getTingDiscardOptions(human.hand, human.melds) : [];

  if (humanReaction?.canHu || canSelfHu) return "hu";
  if (humanReaction?.canPeng || humanReaction?.canGang || turnAnGangKinds.length > 0 || turnBuGangMelds.length > 0) {
    return "meld";
  }
  if (tingOptions.length > 0) return "liangdao";
  if (playable) return "turn";
  return null;
}
