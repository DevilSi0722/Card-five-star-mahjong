import type { TileBackId } from "@/store/uiStore";

export interface TileBackOption {
  id: TileBackId;
  name: string;
  src: string;
  edgeColor: string;
}

export const TILE_BACK_OPTIONS: TileBackOption[] = [
  {
    id: "ink-cloud",
    name: "水墨流云",
    src: "/generated/tile-backs/back-ink-cloud-1k.png",
    edgeColor: "#17243b",
  },
  {
    id: "jade-phoenix",
    name: "碧羽呈祥",
    src: "/generated/tile-backs/back-jade-phoenix-1k.png",
    edgeColor: "#0f5a4d",
  },
  {
    id: "cinnabar-bell",
    name: "朱砂钟韵",
    src: "/generated/tile-backs/back-cinnabar-bell-1k.png",
    edgeColor: "#641c1d",
  },
  {
    id: "black-gold-thunder",
    name: "玄金雷纹",
    src: "/generated/tile-backs/back-black-gold-thunder-1k.png",
    edgeColor: "#1b1b1d",
  },
];

export function getTileBackOption(id: TileBackId): TileBackOption {
  return TILE_BACK_OPTIONS.find((option) => option.id === id) ?? TILE_BACK_OPTIONS[0];
}
