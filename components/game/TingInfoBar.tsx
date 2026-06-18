"use client";

import Image from "next/image";
import { useMemo } from "react";
import frontTileFace from "@/png/optimized/front.webp";
import { useGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { getWaitDetails, type WaitDetail } from "@/utils/mahjong/tingInfo";
import { TILE_KIND_LABEL } from "@/utils/mahjong/tiles";
import { getTileTextureSrc } from "@/utils/mahjong/tileTextures";

function WaitTile({ wait, compact = false }: { wait: WaitDetail; compact?: boolean }) {
  const textureSrc = getTileTextureSrc(wait.kind);
  const label = TILE_KIND_LABEL[wait.kind];

  return (
    <div
      className={`flex shrink-0 flex-col text-center leading-none ${
        compact
          ? "w-[26px] gap-0.5 text-[9px]"
          : "w-[86px] gap-1.5 rounded-xl border border-gold/20 bg-white/5 px-2 py-2 text-[11px] shadow-sm"
      }`}
    >
      <div
        className={`mx-auto flex shrink-0 items-center justify-center ${
          compact
            ? "relative h-[30px] w-[22px] overflow-visible"
            : "h-[56px] w-[40px] rounded-md border border-slate-300/75 bg-[#fbf6ea] shadow-inner"
        }`}
        title={label}
        aria-label={label}
      >
        {compact ? (
          <Image
            src={frontTileFace}
            alt=""
            fill
            sizes="22px"
            className="object-fill"
            unoptimized
            aria-hidden
          />
        ) : null}
        {textureSrc ? (
          <Image
            src={textureSrc}
            alt={label}
            width={32}
            height={44}
            className={
              compact
                ? "absolute left-1/2 top-[53%] h-[20px] w-[14px] -translate-x-1/2 -translate-y-1/2 object-contain"
                : "h-11 w-8 object-contain"
            }
            unoptimized
          />
        ) : null}
      </div>
      <div className="grid gap-0.5 leading-none">
        <span className={wait.remaining > 0 ? "font-semibold text-emerald-200" : "font-semibold text-rose-300"}>
          {compact ? wait.remaining : `余 ${wait.remaining}`}
        </span>
        <span className="font-semibold text-amber-200">×{wait.multiplier}</span>
      </div>
    </div>
  );
}

export function TingInfoBar() {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const players = useGameStore((state) => state.players);
  const phase = useGameStore((state) => state.phase);
  const maxWinMultiplier = useGameStore((state) => state.maxWinMultiplier);
  const netRole = useGameStore((state) => state.netRole);
  const hoveredTileId = useUiStore((state) => state.hoveredTileId);
  const hardcoreModeEnabled = useUiStore((state) => state.hardcoreModeEnabled);

  const human = players.human;
  const hideTingInfo = netRole === "single" && hardcoreModeEnabled;

  // 计算要展示的听牌信息：
  // 1) 已亮倒：常驻展示当前所听（以现有手牌为准）
  // 2) 未亮倒但当前已上听：常驻展示当前所听
  // 3) 悬浮某张可听牌：展示「打出这张后」所听
  const info = useMemo<{ title: string; waits: WaitDetail[] } | null>(() => {
    if (hideTingInfo) return null;
    if (phase === "rolling" || phase === "settled" || phase === "draw") return null;

    // 已亮倒：直接用当前手牌（亮倒后手牌即为听牌状态的 3n+1 张）
    if (human.isLiangDao) {
      const handForWaits =
        human.lastDrawnTileId && human.hand.length % 3 === 2
          ? human.hand.filter((tile) => tile.id !== human.lastDrawnTileId)
          : human.hand;
      const waits = getWaitDetails(handForWaits, human.melds, {
        players,
        observerId: "human",
        isLiangDao: true,
        maxWinMultiplier,
      });
      if (waits.length === 0) return null;
      return { title: "已亮倒，听", waits };
    }

    if (human.hand.length % 3 === 1) {
      const waits = getWaitDetails(human.hand, human.melds, {
        players,
        observerId: "human",
        isLiangDao: false,
        maxWinMultiplier,
      });
      if (waits.length > 0) return { title: "已上听，听", waits };
    }

    // 悬浮某张牌：模拟打出它后的听牌
    if (hoveredTileId) {
      const tile = human.hand.find((item) => item.id === hoveredTileId);
      if (!tile) return null;
      const remaining = human.hand.filter((item) => item.id !== hoveredTileId);
      // 仅在打出后达到 3n+1 张才有意义
      if (remaining.length % 3 !== 1) return null;
      const waits = getWaitDetails(remaining, human.melds, {
        players,
        observerId: "human",
        isLiangDao: false,
        maxWinMultiplier,
      });
      if (waits.length === 0) return null;
      return { title: `打出 ${TILE_KIND_LABEL[tile.kind]} 后听`, waits };
    }

    return null;
  }, [hideTingInfo, phase, human.isLiangDao, human.hand, human.lastDrawnTileId, human.melds, hoveredTileId, maxWinMultiplier, players]);

  if (!info) return null;

  const totalRemaining = info.waits.reduce((sum, wait) => sum + wait.remaining, 0);

  return (
    <div
      className={`pointer-events-none fixed z-20 ${
        isMobileLandscape
          ? "mobile-landscape-ting top-[max(0.35rem,env(safe-area-inset-top))] max-w-[min(320px,calc(100vw-7.5rem))]"
          : "right-5 top-[62%] max-w-[calc(100vw-1.5rem)] -translate-y-1/2"
      }`}
    >
      <div
        className={`pointer-events-auto flex w-max max-w-full flex-col overflow-auto hud-scrollbar ${
          isMobileLandscape
            ? "max-h-[calc(100dvh-1rem)] bg-transparent"
            : "surface-panel max-h-[calc(100dvh-2rem)] gap-3 rounded-xl px-4 py-4"
        }`}
      >
        {isMobileLandscape ? null : (
          <div className="flex flex-col gap-1.5 text-sm font-semibold text-gold-soft">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_8px_rgba(233,196,106,0.7)]" />
              {info.title}
            </span>
            <span className="font-normal text-slate-400">共 <span className="tabular-nums text-bone">{totalRemaining}</span> 张可胡</span>
          </div>
        )}
        <div className={`flex max-w-full flex-nowrap overflow-x-auto hud-scrollbar ${isMobileLandscape ? "gap-[2px] pb-0" : "gap-2.5 pb-1"}`}>
          {info.waits.map((wait) => <WaitTile key={wait.kind} wait={wait} compact={isMobileLandscape} />)}
        </div>
      </div>
    </div>
  );
}
