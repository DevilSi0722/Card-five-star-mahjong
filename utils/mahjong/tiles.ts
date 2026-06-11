import type { DragonRank, TileInstance, TileKind, TileRank, TileSuit } from "@/types/mahjong";

export const PLAYER_ORDER = ["human", "ai_right", "ai_left"] as const;

export const DRAGON_RANKS: DragonRank[] = ["red", "green", "white"];
export const NUMBER_SUITS: TileSuit[] = ["dot", "bamboo"];

export const ALL_TILE_KINDS: TileKind[] = [
  ...NUMBER_SUITS.flatMap((suit) =>
    Array.from({ length: 9 }, (_, index) => `${suit}-${index + 1}` as TileKind),
  ),
  ...DRAGON_RANKS.map((rank) => `dragon-${rank}` as TileKind),
];

export const TILE_KIND_LABEL: Record<TileKind, string> = Object.fromEntries(
  ALL_TILE_KINDS.map((kind) => {
    const parsed = parseTileKind(kind);
    if (parsed.suit === "dot") return [kind, `${parsed.rank}筒`];
    if (parsed.suit === "bamboo") return [kind, `${parsed.rank}条`];
    if (parsed.rank === "red") return [kind, "中"];
    if (parsed.rank === "green") return [kind, "发"];
    return [kind, "白"];
  }),
) as Record<TileKind, string>;

export const TILE_KIND_SHORT_LABEL: Record<TileKind, string> = Object.fromEntries(
  ALL_TILE_KINDS.map((kind) => {
    const parsed = parseTileKind(kind);
    if (parsed.suit === "dot") return [kind, `${parsed.rank}●`];
    if (parsed.suit === "bamboo") return [kind, `${parsed.rank}〡`];
    if (parsed.rank === "red") return [kind, "中"];
    if (parsed.rank === "green") return [kind, "發"];
    return [kind, "白"];
  }),
) as Record<TileKind, string>;

export function makeTileKind(suit: TileSuit, rank: TileRank): TileKind {
  return `${suit}-${rank}` as TileKind;
}

export function parseTileKind(kind: TileKind): { suit: TileSuit; rank: TileRank } {
  const [suit, rank] = kind.split("-") as [TileSuit, string];
  if (suit === "dragon") return { suit, rank: rank as DragonRank };
  return { suit, rank: Number(rank) };
}

export function createTileSet(): TileInstance[] {
  const tiles: TileInstance[] = [];
  for (const kind of ALL_TILE_KINDS) {
    const { suit, rank } = parseTileKind(kind);
    for (let copy = 1; copy <= 4; copy += 1) {
      tiles.push({
        id: `${kind}-${copy}`,
        suit,
        rank,
        kind,
        copy,
      });
    }
  }
  return tiles;
}

export function tileSortValue(tileOrKind: TileInstance | TileKind): number {
  const kind = typeof tileOrKind === "string" ? tileOrKind : tileOrKind.kind;
  const { suit, rank } = parseTileKind(kind);
  if (suit === "dot") return Number(rank);
  if (suit === "bamboo") return 20 + Number(rank);
  const dragonOrder: Record<DragonRank, number> = { red: 41, green: 42, white: 43 };
  return dragonOrder[rank as DragonRank];
}

export function sortTiles<T extends TileInstance>(tiles: T[]): T[] {
  return [...tiles].sort((a, b) => tileSortValue(a) - tileSortValue(b) || a.copy - b.copy);
}

export function countKinds(tiles: TileInstance[]): Map<TileKind, number> {
  const counts = new Map<TileKind, number>();
  for (const tile of tiles) {
    counts.set(tile.kind, (counts.get(tile.kind) ?? 0) + 1);
  }
  return counts;
}

export function nextPlayerId<T extends string>(order: readonly T[], current: T): T {
  return order[(order.indexOf(current) + 1) % order.length];
}

export function orderedAfter<T extends string>(order: readonly T[], current: T): T[] {
  const index = order.indexOf(current);
  return [order[(index + 1) % order.length], order[(index + 2) % order.length]];
}

export function tileColor(kind: TileKind): string {
  const { suit, rank } = parseTileKind(kind);
  if (suit === "dot") return "#c2393b";
  if (suit === "bamboo") return "#1f8f5f";
  if (rank === "red") return "#d0262f";
  if (rank === "green") return "#15945b";
  return "#f1f5f9";
}

export function isSameKind(a: TileInstance, b: TileInstance): boolean {
  return a.kind === b.kind;
}
