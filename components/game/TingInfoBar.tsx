"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { getWaitDetails, type WaitDetail } from "@/utils/mahjong/tingInfo";
import { TILE_KIND_LABEL } from "@/utils/mahjong/tiles";
import { getTileTextureSrc } from "@/utils/mahjong/tileTextures";

function WaitTile({ wait }: { wait: WaitDetail }) {
  const textureSrc = getTileTextureSrc(wait.kind);
  const label = TILE_KIND_LABEL[wait.kind];

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/12 bg-white/8 px-2.5 py-2 text-xs shadow-sm">
      <div
        className="flex h-[58px] w-[42px] shrink-0 items-center justify-center rounded-md border border-slate-300/75 bg-[#fbf6ea] shadow-inner"
        title={label}
        aria-label={label}
      >
        {textureSrc ? (
          <Image
            src={textureSrc}
            alt={label}
            width={32}
            height={44}
            className="h-11 w-8 object-contain"
            unoptimized
          />
        ) : null}
      </div>
      <div className="grid gap-1 leading-none">
        <span className={wait.remaining > 0 ? "font-semibold text-emerald-200" : "font-semibold text-rose-300"}>
          余 {wait.remaining}
        </span>
        <span className="font-semibold text-amber-200">×{wait.multiplier}</span>
      </div>
    </div>
  );
}

export function TingInfoBar() {
  const players = useGameStore((state) => state.players);
  const phase = useGameStore((state) => state.phase);
  const hoveredTileId = useUiStore((state) => state.hoveredTileId);

  const human = players.human;

  // 计算要展示的听牌信息：
  // 1) 已亮倒：常驻展示当前所听（以现有手牌为准）
  // 2) 悬浮某张可听牌：展示「打出这张后」所听
  const info = useMemo<{ title: string; waits: WaitDetail[] } | null>(() => {
    if (phase === "settled" || phase === "draw") return null;

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
      });
      if (waits.length === 0) return null;
      return { title: "已亮倒，听", waits };
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
      });
      if (waits.length === 0) return null;
      return { title: `打出 ${TILE_KIND_LABEL[tile.kind]} 后听`, waits };
    }

    return null;
  }, [phase, human.isLiangDao, human.hand, human.lastDrawnTileId, human.melds, hoveredTileId, players]);

  if (!info) return null;

  const totalRemaining = info.waits.reduce((sum, wait) => sum + wait.remaining, 0);

  return (
    <div className="pointer-events-none fixed right-5 top-1/2 z-20 w-[min(260px,calc(100vw-1.5rem))] -translate-y-1/2">
      <div className="pointer-events-auto flex max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-auto rounded-lg border border-yellow-300/35 bg-slate-950/86 px-4 py-4 shadow-panel backdrop-blur-md hud-scrollbar">
        <div className="flex flex-col gap-1.5 text-sm font-semibold text-yellow-200">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            {info.title}
          </span>
          <span className="font-normal text-slate-400">共 {totalRemaining} 张可胡</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {info.waits.map((wait) => <WaitTile key={wait.kind} wait={wait} />)}
        </div>
      </div>
    </div>
  );
}
