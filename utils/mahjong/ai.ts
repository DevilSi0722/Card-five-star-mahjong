import type { AiDecision, Meld, Player, PlayerId, TileInstance, TileKind } from "@/types/mahjong";
import { analyzeWin, getAnGangKinds, getTingDiscardOptions, getWinningKinds } from "./handAnalyzer";
import { ALL_TILE_KINDS, countKinds, parseTileKind, tileSortValue } from "./tiles";

function tileBaseRisk(tile: TileInstance): number {
  const { suit, rank } = tile;
  if (suit === "dragon") return 18;
  const numeric = Number(rank);
  if (numeric === 1 || numeric === 9) return 9;
  if (numeric === 2 || numeric === 8) return 11;
  if (numeric === 5) return 15;
  return 13;
}

function tileKeepValue(tile: TileInstance, hand: TileInstance[]): number {
  const counts = countKinds(hand);
  const same = counts.get(tile.kind) ?? 0;
  let value = same >= 2 ? 18 : 0;
  const { suit, rank } = tile;
  if (suit !== "dragon") {
    const numeric = Number(rank);
    const neighbors = [numeric - 2, numeric - 1, numeric + 1, numeric + 2]
      .filter((item) => item >= 1 && item <= 9)
      .map((item) => `${suit}-${item}` as TileKind);
    value += neighbors.reduce((sum, kind) => sum + (counts.get(kind) ?? 0) * 4, 0);
  }
  if (suit === "dragon" && same === 1) value -= 8;
  return value;
}

export function getDangerousWaits(players: Record<PlayerId, Player>, selfId: PlayerId): Set<TileKind> {
  const danger = new Set<TileKind>();
  for (const player of Object.values(players)) {
    if (player.id === selfId || !player.isLiangDao) continue;
    const waits = player.waitingKinds.length > 0 ? player.waitingKinds : getWinningKinds(player.hand, player.melds);
    for (const kind of waits) danger.add(kind);
  }
  return danger;
}

export function getForbiddenDiscards(players: Record<PlayerId, Player>, selfId: PlayerId): Set<TileKind> {
  return getDangerousWaits(players, selfId);
}

export function calculateDiscardDanger(
  tile: TileInstance,
  players: Record<PlayerId, Player>,
  selfId: PlayerId,
): number {
  let danger = tileBaseRisk(tile);
  const exposedWaits = getDangerousWaits(players, selfId);
  if (exposedWaits.has(tile.kind)) danger += 1000;
  return danger;
}

export function chooseDiscard(
  player: Player,
  players: Record<PlayerId, Player>,
): AiDecision {
  if (player.isLiangDao && player.lastDrawnTileId) {
    return {
      action: "discard",
      tileId: player.lastDrawnTileId,
      reason: "亮倒后摸什么打什么",
    };
  }

  const forbidden = getForbiddenDiscards(players, player.id);
  const candidates = player.hand.filter((tile) => !forbidden.has(tile.kind));

  if (candidates.length === 0) {
    return {
      action: "pass",
      reason: "所有可打牌都会点亮倒玩家，无法安全出牌",
    };
  }

  const options = candidates.map((tile) => {
    const danger = calculateDiscardDanger(tile, players, player.id);
    const keep = tileKeepValue(tile, player.hand);
    const { suit, rank } = tile;
    const singleDragonPenalty =
      suit === "dragon" && (countKinds(player.hand).get(tile.kind) ?? 0) === 1 ? -18 : 0;
    return {
      tile,
      score: danger + keep + singleDragonPenalty,
    };
  });

  options.sort((a, b) => a.score - b.score || tileSortValue(a.tile) - tileSortValue(b.tile));
  const tile = options[0]?.tile ?? player.hand[0];
  return {
    action: "discard",
    tileId: tile.id,
    reason: "选择危险度和保留价值最低的牌",
  };
}

export function shouldDeclareLiangDao(player: Player): AiDecision | undefined {
  if (player.isLiangDao || player.hand.length % 3 !== 2) return undefined;
  const options = getTingDiscardOptions(player.hand, player.melds);
  if (options.length === 0) return undefined;
  const best = [...options].sort((a, b) => b.waits.length - a.waits.length)[0];
  if (Math.random() > 0.6) return undefined;
  return {
    action: "liang_dao",
    tileId: best.discardTileId,
    reason: `听 ${best.waits.length} 门，AI 选择亮倒`,
  };
}

export function chooseReaction(
  player: Player,
  discard: TileInstance,
  canHu: boolean,
  canGang: boolean,
  canPeng: boolean,
): AiDecision {
  if (canHu) return { action: "hu", reason: "胡牌优先" };
  if (player.isLiangDao) return { action: "pass", reason: "亮倒后不能碰杠" };
  if (canGang) return { action: "ming_gang", tileKind: discard.kind, reason: "可明杠" };
  if (canPeng) {
    const sameCount = player.hand.filter((tile) => tile.kind === discard.kind).length;
    const isUsefulPair = sameCount >= 2 && parseTileKind(discard.kind).suit === "dragon";
    if (isUsefulPair || Math.random() < 0.35) {
      return { action: "peng", tileKind: discard.kind, reason: "碰牌形成刻子" };
    }
  }
  return { action: "pass", reason: "不响应" };
}

export function chooseGang(player: Player): AiDecision | undefined {
  if (player.isLiangDao) return undefined;
  const anGang = getAnGangKinds(player.hand)[0];
  if (anGang) return { action: "an_gang", tileKind: anGang, reason: "手牌四张相同，暗杠" };
  const buGang = player.melds.find((meld: Meld) => {
    if (meld.type !== "peng") return false;
    return player.hand.some((tile) => tile.kind === meld.tiles[0].kind);
  });
  if (buGang) return { action: "bu_gang", meldId: buGang.id, reason: "碰后摸到第四张，补杠" };
  return undefined;
}

export function canSelfWin(player: Player, winningTile?: TileInstance) {
  return analyzeWin(player.hand, winningTile?.kind ?? player.lastDrawnTileId ? player.hand.find((tile) => tile.id === player.lastDrawnTileId)?.kind : undefined, player.melds);
}

export function allVisibleKinds(players: Record<PlayerId, Player>): TileKind[] {
  const kinds: TileKind[] = [];
  for (const player of Object.values(players)) {
    for (const tile of player.discards) kinds.push(tile.kind);
    for (const meld of player.melds) kinds.push(...meld.tiles.map((tile) => tile.kind));
    if (player.isLiangDao) kinds.push(...player.hand.map((tile) => tile.kind));
  }
  return kinds.filter((kind) => ALL_TILE_KINDS.includes(kind));
}
