import type { StaticImageData } from "next/image";
import type { TileKind } from "@/types/mahjong";

import dot1 from "@/png/1p.png";
import dot2 from "@/png/2p.png";
import dot3 from "@/png/3p.png";
import dot4 from "@/png/4p.png";
import dot5 from "@/png/5p.png";
import dot6 from "@/png/6p.png";
import dot7 from "@/png/7p.png";
import dot8 from "@/png/8p.png";
import dot9 from "@/png/9p.png";
import bamboo1 from "@/png/1s.png";
import bamboo2 from "@/png/2s.png";
import bamboo3 from "@/png/3s.png";
import bamboo4 from "@/png/4s.png";
import bamboo5 from "@/png/5s.png";
import bamboo6 from "@/png/6s.png";
import bamboo7 from "@/png/7s.png";
import bamboo8 from "@/png/8s.png";
import bamboo9 from "@/png/9s.png";
import fa from "@/png/fa.png";
import zhong from "@/png/zhong.png";

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

