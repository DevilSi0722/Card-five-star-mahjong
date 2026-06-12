"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ScoreResult } from "@/types/mahjong";
import tileBack from "@/png/back.png";
import frontTileFace from "@/png/optimized/front.webp";
import { TILE_KIND_LABEL } from "@/utils/mahjong/tiles";
import { getTileTextureSrc } from "@/utils/mahjong/tileTextures";

export function BuyHorseRevealOverlay({ result }: { result: NonNullable<ScoreResult["buyHorse"]> }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 420);
    return () => window.clearTimeout(timer);
  }, []);

  const label = TILE_KIND_LABEL[result.tile.kind];
  const textureSrc = getTileTextureSrc(result.tile.kind);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="flex flex-col items-center gap-5">
        <div className="text-center">
          <div className="text-sm font-semibold tracking-[0.24em] text-sky-200">买马</div>
          <div className="mt-1 text-2xl font-bold text-white">开马牌</div>
        </div>

        <div className="horse-reveal-stage horse-reveal-stage--large">
          <div className={`horse-card horse-card--large ${revealed ? "horse-card--revealed" : ""}`}>
            {revealed ? (
              <div className="horse-card__front-surface">
                <Image
                  src={frontTileFace}
                  alt=""
                  width={102}
                  height={140}
                  className="horse-card__base"
                  aria-hidden
                  unoptimized
                />
                {textureSrc ? (
                  <Image
                    src={textureSrc}
                    alt={label}
                    width={68}
                    height={96}
                    className="horse-card__front-pattern"
                    priority
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-lg font-bold text-slate-900">{label}</span>
                )}
              </div>
            ) : (
              <Image src={tileBack} alt="牌背" fill className="object-cover" priority unoptimized />
            )}
          </div>
        </div>

        <div className={`text-center transition-all duration-500 ${revealed ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
          <div className="text-xl font-bold text-sky-100">{label}</div>
          <div className="mt-1 text-sm text-sky-200">点数 {result.value}</div>
          <div className="mt-2 text-2xl font-bold text-emerald-200">额外 +{result.bonus}</div>
        </div>
      </div>
      <div className="horse-reveal-burst horse-reveal-burst--center" />
    </div>
  );
}
