import type { Meld, Player, PlayerId, TileInstance, TileKind } from "@/types/mahjong";
import { analyzeWin, getTingDiscardOptions } from "./handAnalyzer";
import { calculateFans, capWinMultiplier, multiplyFans } from "./scoring";
import { ALL_TILE_KINDS, parseTileKind } from "./tiles";

export { getRevealedTileIds } from "./handAnalyzer";

export interface WaitDetail {
  kind: TileKind;
  /** 该牌在牌山+他人手牌中理论剩余张数（4 - 已可见张数） */
  remaining: number;
  /** 胡这张牌的得分倍率（各番型倍率连乘） */
  multiplier: number;
}

/**
 * 统计场面上「已可见」的各类牌张数：所有玩家的弃牌、所有副露、
 * 任意已亮倒玩家亮出的全部手牌，以及指定观察者自己的全部手牌。
 * 用于推算某种听牌还剩多少张可摸。
 */
function visibleCounts(players: Record<PlayerId, Player>, observerId: PlayerId): Map<TileKind, number> {
  const counts = new Map<TileKind, number>();
  const add = (kind: TileKind) => counts.set(kind, (counts.get(kind) ?? 0) + 1);
  for (const player of Object.values(players)) {
    for (const tile of player.discards) add(tile.kind);
    for (const meld of player.melds) for (const tile of meld.tiles) add(tile.kind);
    if (player.id === observerId) {
      // 观察者自己的全部手牌都可见
      for (const tile of player.hand) add(tile.kind);
    } else if (player.isLiangDao) {
      // 其他玩家亮倒：全手牌已展示
      for (const tile of player.hand) add(tile.kind);
    }
  }
  return counts;
}

/**
 * 计算一手 13 张牌（含已碰杠的 melds）听哪些牌，以及每种听牌的剩余张数与胡牌倍率。
 */
export function getWaitDetails(
  hand13: TileInstance[],
  melds: Meld[],
  options: { players: Record<PlayerId, Player>; observerId: PlayerId; isLiangDao: boolean },
): WaitDetail[] {
  const seen = visibleCounts(options.players, options.observerId);
  const details: WaitDetail[] = [];

  for (const kind of ALL_TILE_KINDS) {
    const { suit, rank } = parseTileKind(kind);
    const virtualTile: TileInstance = { id: `virtual-${kind}`, suit, rank, kind, copy: 0 };
    const win = analyzeWin([...hand13, virtualTile], kind, melds);
    if (!win.isWin) continue;

    const fans = calculateFans(win, { isLiangDao: options.isLiangDao, method: "discard" });
    const multiplier = capWinMultiplier(multiplyFans(fans));
    const remaining = Math.max(0, 4 - (seen.get(kind) ?? 0));
    details.push({ kind, remaining, multiplier });
  }

  return details;
}

/** 一手牌中，打出后即可听牌的牌 id 集合（用于在牌上方显示提示圆点）。 */
export function getTingDiscardTileIds(hand: TileInstance[], melds: Meld[]): Set<string> {
  // 仅在“摸牌后”的 3n+2 张状态下，打一张才进入听牌判断
  if (hand.length % 3 !== 2) return new Set();
  return new Set(getTingDiscardOptions(hand, melds).map((option) => option.discardTileId));
}
