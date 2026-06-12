"use client";

import Image from "next/image";
import { useEffect, useMemo } from "react";
import frontTileFace from "@/png/optimized/front.webp";
import { useGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { getTingDiscardTileIds } from "@/utils/mahjong/tingInfo";
import { TILE_KIND_LABEL } from "@/utils/mahjong/tiles";
import { ALL_TILE_TEXTURE_SRCS, getTileTextureSrc } from "@/utils/mahjong/tileTextures";

const DRAWN_TILE_GAP_CLASS = "ml-3 sm:ml-5";

export function HumanHandOverlay() {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const human = useGameStore((state) => state.players.human);
  const phase = useGameStore((state) => state.phase);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const selectedTileId = useGameStore((state) => state.selectedTileId);
  const aiLeft = useGameStore((state) => state.players.ai_left);
  const aiRight = useGameStore((state) => state.players.ai_right);
  const pendingReactions = useGameStore((state) => state.pendingReactions);
  const reactionPasses = useGameStore((state) => state.reactionPasses);
  const selectTile = useGameStore((state) => state.selectTile);
  const discardTile = useGameStore((state) => state.discardTile);
  const setHoveredTileId = useUiStore((state) => state.setHoveredTileId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sources = [frontTileFace.src, ...ALL_TILE_TEXTURE_SRCS];
    for (const src of sources) {
      const image = new window.Image();
      image.decoding = "async";
      image.src = src;
      void image.decode?.().catch(() => undefined);
    }
  }, []);

  const current = phase === "playing" && currentPlayerId === "human";
  const revealAll = phase === "settled" || phase === "draw";
  const interactive = current && !human.autoPlay && !human.isLiangDao && !revealAll;
  const drawnId = !human.isLiangDao && !revealAll ? human.lastDrawnTileId : undefined;
  const hasDrawn = drawnId ? human.hand.some((tile) => tile.id === drawnId) : false;
  const rest = hasDrawn ? human.hand.filter((tile) => tile.id !== drawnId) : human.hand;
  const drawn = hasDrawn ? human.hand.find((tile) => tile.id === drawnId) : undefined;
  const tiles = drawn ? [...rest, drawn] : rest;
  const exposedWaitKinds = useMemo(
    () =>
      new Set(
        [aiLeft, aiRight]
          .filter((player) => player.isLiangDao)
          .flatMap((player) => player.waitingKinds),
      ),
    [aiLeft, aiRight],
  );

  const tingTileIds = useMemo(
    () => (interactive ? getTingDiscardTileIds(human.hand, human.melds) : new Set<string>()),
    [human.hand, human.melds, interactive],
  );
  const remainingReactionOptions =
    phase === "responding" && pendingReactions
      ? pendingReactions.options.filter((option) => !reactionPasses.includes(option.playerId))
      : [];
  const activeReaction =
    remainingReactionOptions.find((option) => option.canHu) ??
    remainingReactionOptions.find((option) => option.canGang) ??
    remainingReactionOptions.find((option) => option.canPeng);
  const canPengKind =
    activeReaction?.playerId === "human" && activeReaction.canPeng
      ? pendingReactions?.discard.tile.kind
      : undefined;

  if (human.hand.length === 0 || human.isLiangDao || revealAll) return null;

  return (
    <div
      className={`pointer-events-none fixed left-0 right-0 z-20 ${
        isMobileLandscape ? "mobile-landscape-hand" : "bottom-4"
      }`}
    >
      <div
        className={`mx-auto flex w-full items-end gap-0 overflow-x-auto pb-1 hud-scrollbar ${
          isMobileLandscape ? "mobile-landscape-hand-inner justify-center pt-3" : "justify-start px-4 pt-5 sm:justify-center sm:px-6"
        }`}
      >
        {tiles.map((tile) => {
          const textureSrc = getTileTextureSrc(tile.kind);
          const selected = selectedTileId === tile.id;
          const isDrawn = drawn?.id === tile.id;
          const label = TILE_KIND_LABEL[tile.kind];
          const dangerous = exposedWaitKinds.has(tile.kind);
          const canPengTile = tile.kind === canPengKind;

          return (
            <button
              key={tile.id}
              type="button"
              title={label}
              aria-label={label}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => selectTile(tile.id)}
              onDoubleClick={() => {
                if (interactive) discardTile("human", tile.id);
              }}
              onMouseEnter={() => {
                if (interactive) setHoveredTileId(tile.id);
              }}
              onMouseLeave={() => {
                if (interactive) setHoveredTileId(undefined);
              }}
              className={`relative shrink-0 overflow-visible rounded-lg bg-transparent transition ${
                isMobileLandscape ? "h-[92px] w-[63px]" : "h-[126px] w-[86px] sm:h-[138px] sm:w-[94px]"
              } ${isDrawn ? "human-hand-tile--enter" : ""} ${
                isDrawn ? DRAWN_TILE_GAP_CLASS : ""
              } ${
                selected
                  ? `${isMobileLandscape ? "-translate-y-2" : "-translate-y-3"} shadow-[0_14px_28px_rgba(250,204,21,0.26),0_0_18px_rgba(250,204,21,0.28)]`
                  : canPengTile
                    ? "animate-pulse shadow-[0_12px_24px_rgba(250,204,21,0.22),0_0_14px_rgba(250,204,21,0.24)]"
                  : dangerous
                    ? "shadow-[0_12px_24px_rgba(239,68,68,0.22),0_0_14px_rgba(239,68,68,0.22)]"
                  : "shadow-panel"
              } ${interactive ? `pointer-events-auto cursor-pointer ${isMobileLandscape ? "hover:-translate-y-2" : "hover:-translate-y-4"}` : "pointer-events-auto cursor-default"}`}
            >
              {selected || canPengTile || dangerous ? (
                <span
                  className={`pointer-events-none absolute inset-x-3 -bottom-1 z-10 h-1 rounded-full blur-[0.5px] ${
                    dangerous ? "bg-red-400/85" : "bg-yellow-300/90"
                  }`}
                />
              ) : null}
              <Image
                src={frontTileFace}
                alt=""
                fill
                sizes={isMobileLandscape ? "63px" : "94px"}
                className="object-fill"
                unoptimized
                priority
                aria-hidden
              />
              {textureSrc ? (
                <Image
                  src={textureSrc}
                  alt={label}
                  width={62}
                  height={86}
                  className={`absolute left-1/2 top-[53%] -translate-x-1/2 -translate-y-1/2 object-contain ${
                    isMobileLandscape ? "h-[61px] w-[44px]" : "h-[84px] w-[60px] sm:h-[92px] sm:w-[66px]"
                  }`}
                  unoptimized
                  priority
                  loading="eager"
                />
              ) : null}
              {tingTileIds.has(tile.id) ? (
                <span className="absolute left-1/2 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.9)]" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
