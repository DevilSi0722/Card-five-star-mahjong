import type { Meld, MeldGroup, TileInstance, TileKind, WinDecomposition, WinResult } from "@/types/mahjong";
import {
  ALL_TILE_KINDS,
  countKinds,
  makeTileKind,
  parseTileKind,
  sortTiles,
  tileSortValue,
} from "./tiles";

type CountRecord = Record<TileKind, number>;

function emptyCounts(): CountRecord {
  return Object.fromEntries(ALL_TILE_KINDS.map((kind) => [kind, 0])) as CountRecord;
}

function toCounts(tiles: TileInstance[]): CountRecord {
  const counts = emptyCounts();
  for (const tile of tiles) counts[tile.kind] += 1;
  return counts;
}

function cloneCounts(counts: CountRecord): CountRecord {
  return { ...counts };
}

function totalCount(counts: CountRecord): number {
  return ALL_TILE_KINDS.reduce((sum, kind) => sum + counts[kind], 0);
}

function firstAvailableKind(counts: CountRecord): TileKind | undefined {
  return ALL_TILE_KINDS.find((kind) => counts[kind] > 0);
}

function canSequence(kind: TileKind): TileKind[] | undefined {
  const { suit, rank } = parseTileKind(kind);
  if (suit === "dragon" || typeof rank !== "number" || rank > 7) return undefined;
  return [kind, makeTileKind(suit, rank + 1), makeTileKind(suit, rank + 2)];
}

function meldToGroup(meld: Meld): MeldGroup {
  const kind = meld.tiles[0].kind;
  return {
    type: meld.type === "peng" ? "triplet" : "quad",
    kind,
    kinds: meld.tiles.map((tile) => tile.kind),
  };
}

function findMeldGroups(counts: CountRecord, groupsNeeded: number): MeldGroup[][] {
  if (groupsNeeded === 0) return totalCount(counts) === 0 ? [[]] : [];
  const first = firstAvailableKind(counts);
  if (!first) return [];

  const results: MeldGroup[][] = [];

  if (counts[first] >= 3) {
    const nextCounts = cloneCounts(counts);
    nextCounts[first] -= 3;
    for (const rest of findMeldGroups(nextCounts, groupsNeeded - 1)) {
      results.push([{ type: "triplet", kind: first, kinds: [first, first, first] }, ...rest]);
    }
  }

  const sequence = canSequence(first);
  if (sequence && sequence.every((kind) => counts[kind] > 0)) {
    const nextCounts = cloneCounts(counts);
    for (const kind of sequence) nextCounts[kind] -= 1;
    for (const rest of findMeldGroups(nextCounts, groupsNeeded - 1)) {
      results.push([{ type: "sequence", kind: first, kinds: sequence }, ...rest]);
    }
  }

  return results;
}

function findStandardDecompositions(
  tiles: TileInstance[],
  melds: Meld[] = [],
): WinDecomposition[] {
  const exposedGroups = melds.map(meldToGroup);
  const groupsNeeded = 4 - exposedGroups.length;
  if (groupsNeeded < 0 || tiles.length !== groupsNeeded * 3 + 2) return [];

  const counts = toCounts(tiles);
  const decompositions: WinDecomposition[] = [];

  for (const pairKind of ALL_TILE_KINDS) {
    if (counts[pairKind] < 2) continue;
    const nextCounts = cloneCounts(counts);
    nextCounts[pairKind] -= 2;
    const meldGroups = findMeldGroups(nextCounts, groupsNeeded);
    for (const groups of meldGroups) {
      decompositions.push({
        groups: [
          ...exposedGroups,
          { type: "pair", kind: pairKind, kinds: [pairKind, pairKind] },
          ...groups,
        ],
      });
    }
  }

  return decompositions;
}

function findSevenPairs(tiles: TileInstance[], melds: Meld[] = []): WinDecomposition | undefined {
  if (melds.length > 0 || tiles.length !== 14) return undefined;
  const counts = countKinds(tiles);
  let pairCount = 0;
  const groups: MeldGroup[] = [];
  for (const kind of ALL_TILE_KINDS) {
    const count = counts.get(kind) ?? 0;
    if (count % 2 !== 0) return undefined;
    if (count > 0) {
      pairCount += count / 2;
      for (let index = 0; index < count / 2; index += 1) {
        groups.push({ type: "pair", kind, kinds: [kind, kind] });
      }
    }
  }
  return pairCount === 7 ? { groups, isSevenPairs: true } : undefined;
}

function isQingYiSe(groups: MeldGroup[]): boolean {
  const suits = new Set(groups.flatMap((group) => group.kinds).map((kind) => parseTileKind(kind).suit));
  return suits.size === 1 && (suits.has("dot") || suits.has("bamboo"));
}

function dragonTripletCount(groups: MeldGroup[]): number {
  return groups.filter((group) => {
    if (group.type !== "triplet" && group.type !== "quad") return false;
    return parseTileKind(group.kind).suit === "dragon";
  }).length;
}

function hasDragonPair(groups: MeldGroup[]): boolean {
  return groups.some((group) => group.type === "pair" && parseTileKind(group.kind).suit === "dragon");
}

function isPengPengHu(groups: MeldGroup[], isSevenPairs?: boolean): boolean {
  if (isSevenPairs) return false;
  return groups.every((group) => group.type !== "sequence");
}

function countRequiredKind(groups: MeldGroup[], target: TileKind): number {
  return groups.reduce(
    (sum, group) => sum + group.kinds.filter((kind) => kind === target).length,
    0,
  );
}

function isKaWuXing(
  decomposition: WinDecomposition,
  tiles: TileInstance[],
  winningTileKind?: TileKind,
): boolean {
  if (winningTileKind !== "dot-5" && winningTileKind !== "bamboo-5") return false;
  const { suit } = parseTileKind(winningTileKind);
  const hasMiddleSequence = decomposition.groups.some(
    (group) =>
      group.type === "sequence" &&
      group.kinds[0] === makeTileKind(suit, 4) &&
      group.kinds[1] === winningTileKind &&
      group.kinds[2] === makeTileKind(suit, 6),
  );
  if (!hasMiddleSequence) return false;

  const withoutWinning = [...tiles];
  const removeIndex = withoutWinning.findIndex((tile) => tile.kind === winningTileKind);
  if (removeIndex >= 0) withoutWinning.splice(removeIndex, 1);
  const countsWithoutWinning = countKinds(withoutWinning);
  return countRequiredKind(decomposition.groups, winningTileKind) > (countsWithoutWinning.get(winningTileKind) ?? 0);
}

export function analyzeWin(
  tiles: TileInstance[],
  winningTileKind?: TileKind,
  melds: Meld[] = [],
): WinResult {
  const sorted = sortTiles(tiles);
  const standard = findStandardDecompositions(sorted, melds);
  const sevenPairs = findSevenPairs(sorted, melds);
  const allDecompositions = sevenPairs ? [sevenPairs, ...standard] : standard;

  if (allDecompositions.length === 0) {
    return { isWin: false, winningTileKind };
  }

  const best = [...allDecompositions].sort((a, b) => {
    const aScore = Number(isKaWuXing(a, sorted, winningTileKind)) + Number(isPengPengHu(a.groups, a.isSevenPairs));
    const bScore = Number(isKaWuXing(b, sorted, winningTileKind)) + Number(isPengPengHu(b.groups, b.isSevenPairs));
    return bScore - aScore;
  })[0];

  const dragonTriplets = dragonTripletCount(best.groups);
  const isDaSanYuan = dragonTriplets === 3;
  const isXiaoSanYuan = !isDaSanYuan && dragonTriplets === 2 && hasDragonPair(best.groups);

  return {
    isWin: true,
    decomposition: best,
    allDecompositions,
    isSevenPairs: Boolean(best.isSevenPairs),
    isPengPengHu: isPengPengHu(best.groups, best.isSevenPairs),
    isQingYiSe: isQingYiSe(best.groups),
    isDaSanYuan,
    isXiaoSanYuan,
    isKaWuXing: isKaWuXing(best, sorted, winningTileKind),
    winningTileKind,
  };
}

export function getWinningKinds(tiles13: TileInstance[], melds: Meld[] = []): TileKind[] {
  return ALL_TILE_KINDS.filter((kind) => {
    const { suit, rank } = parseTileKind(kind);
    const virtualTile: TileInstance = {
      id: `virtual-${kind}`,
      suit,
      rank,
      kind,
      copy: 0,
    };
    return analyzeWin([...tiles13, virtualTile], kind, melds).isWin;
  });
}

export function getTingDiscardOptions(
  tiles14: TileInstance[],
  melds: Meld[] = [],
): Array<{ discardTileId: string; discardKind: TileKind; waits: TileKind[] }> {
  const options: Array<{ discardTileId: string; discardKind: TileKind; waits: TileKind[] }> = [];
  for (const tile of tiles14) {
    const remaining = tiles14.filter((item) => item.id !== tile.id);
    const waits = getWinningKinds(remaining, melds);
    if (waits.length > 0) {
      options.push({ discardTileId: tile.id, discardKind: tile.kind, waits });
    }
  }
  return options;
}

/**
 * 计算一手听牌（3n+1 张，含已副露 melds）在「亮倒」时需要亮出的手牌 id 集合。
 * 规则：只亮出与「胡牌张」组合成牌组的那些牌（即听牌结构相关的牌），
 * 已经成型的牌组（完整顺子/刻子、以及与听牌无关的对子）保持暗置不亮。
 * 跨所有听牌取并集，因此双碰、单钓、卡张、连张、七对都会各自亮出对应的牌。
 * 非听牌状态（兜底）返回全部手牌 id。
 */
export function getRevealedTileIds(hand: TileInstance[], melds: Meld[] = []): Set<string> {
  if (hand.length % 3 !== 1) return new Set(hand.map((tile) => tile.id));
  const waits = getWinningKinds(hand, melds);
  if (waits.length === 0) return new Set(hand.map((tile) => tile.id));

  // 每种牌需要亮出的张数：跨所有听牌取最大值（并集）
  const revealCount = new Map<TileKind, number>();
  const bump = (kind: TileKind, n: number) => {
    revealCount.set(kind, Math.max(revealCount.get(kind) ?? 0, n));
  };

  for (const winKind of waits) {
    const { suit, rank } = parseTileKind(winKind);
    const virtualTile: TileInstance = { id: `virtual-${winKind}`, suit, rank, kind: winKind, copy: 0 };
    const win = analyzeWin([...hand, virtualTile], winKind, melds);
    if (!win.decomposition) continue;

    // 该听牌结构下，「来自手牌」且参与「含胡牌张的牌组」的各类牌张数
    const needed = new Map<TileKind, number>();
    win.decomposition.groups.forEach((group, index) => {
      // 前 melds.length 个牌组来自已副露的牌，不在手牌里，跳过
      if (index < melds.length) return;
      if (!group.kinds.includes(winKind)) return;
      let winningProvided = false;
      for (const kind of group.kinds) {
        // 其中一张胡牌张由「胡的这张」提供，不来自手牌
        if (kind === winKind && !winningProvided) {
          winningProvided = true;
          continue;
        }
        needed.set(kind, (needed.get(kind) ?? 0) + 1);
      }
    });
    for (const [kind, n] of needed) bump(kind, n);
  }

  // 将「需亮出张数」映射到具体牌实例
  const revealIds = new Set<string>();
  const taken = new Map<TileKind, number>();
  for (const tile of hand) {
    const want = revealCount.get(tile.kind) ?? 0;
    const got = taken.get(tile.kind) ?? 0;
    if (got < want) {
      revealIds.add(tile.id);
      taken.set(tile.kind, got + 1);
    }
  }
  return revealIds;
}

export function getAnGangKinds(tiles: TileInstance[]): TileKind[] {
  const counts = countKinds(tiles);
  return ALL_TILE_KINDS.filter((kind) => (counts.get(kind) ?? 0) === 4);
}

export function formatKinds(kinds: TileKind[]): string {
  return kinds.sort((a, b) => tileSortValue(a) - tileSortValue(b)).join(",");
}
