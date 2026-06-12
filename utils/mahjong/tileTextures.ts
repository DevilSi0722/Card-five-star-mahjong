import type { StaticImageData } from "next/image";
import type { TileKind } from "@/types/mahjong";

import dot1 from "@/png/optimized/1p.webp";
import dot2 from "@/png/optimized/2p.webp";
import dot3 from "@/png/optimized/3p.webp";
import dot4 from "@/png/optimized/4p.webp";
import dot5 from "@/png/optimized/5p.webp";
import dot6 from "@/png/optimized/6p.webp";
import dot7 from "@/png/optimized/7p.webp";
import dot8 from "@/png/optimized/8p.webp";
import dot9 from "@/png/optimized/9p.webp";
import bamboo1 from "@/png/optimized/1s.webp";
import bamboo2 from "@/png/optimized/2s.webp";
import bamboo3 from "@/png/optimized/3s.webp";
import bamboo4 from "@/png/optimized/4s.webp";
import bamboo5 from "@/png/optimized/5s.webp";
import bamboo6 from "@/png/optimized/6s.webp";
import bamboo7 from "@/png/optimized/7s.webp";
import bamboo8 from "@/png/optimized/8s.webp";
import bamboo9 from "@/png/optimized/9s.webp";
import fa from "@/png/optimized/fa.webp";
import zhong from "@/png/optimized/zhong.webp";

const textureMap: Partial<Record<TileKind, StaticImageData>> = {
  "dot-1": dot1,
  "dot-2": dot2,
  "dot-3": dot3,
  "dot-4": dot4,
  "dot-5": dot5,
  "dot-6": dot6,
  "dot-7": dot7,
  "dot-8": dot8,
  "dot-9": dot9,
  "bamboo-1": bamboo1,
  "bamboo-2": bamboo2,
  "bamboo-3": bamboo3,
  "bamboo-4": bamboo4,
  "bamboo-5": bamboo5,
  "bamboo-6": bamboo6,
  "bamboo-7": bamboo7,
  "bamboo-8": bamboo8,
  "bamboo-9": bamboo9,
  "dragon-green": fa,
  "dragon-red": zhong,
};

export function getTileTextureSrc(kind: TileKind): string | undefined {
  return textureMap[kind]?.src;
}

/** 所有牌面贴图的 URL，供启动时预加载，避免游戏中途首次加载导致画面闪黑。 */
export const ALL_TILE_TEXTURE_SRCS: string[] = Object.values(textureMap)
  .map((image) => image?.src)
  .filter((src): src is string => Boolean(src));
