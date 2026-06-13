"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import frontTileFace from "@/png/optimized/front.webp";
import { useGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { getTingDiscardTileIds } from "@/utils/mahjong/tingInfo";
import { TILE_KIND_LABEL } from "@/utils/mahjong/tiles";
import { ALL_TILE_TEXTURE_SRCS, getTileTextureSrc } from "@/utils/mahjong/tileTextures";

const DRAWN_TILE_GAP_CLASS = "ml-3 sm:ml-5";
const DOUBLE_TAP_MS = 320;
const HAND_REORDER_ANIMATION_MS = 220;
const SWIPE_DISCARD_MIN_DY = 28;
const SWIPE_DISCARD_MAX_DX = 32;

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
  const declareLiangDao = useGameStore((state) => state.declareLiangDao);
  const setHoveredTileId = useUiStore((state) => state.setHoveredTileId);
  const liangDaoArmed = useUiStore((state) => state.liangDaoArmed);
  const setLiangDaoArmed = useUiStore((state) => state.setLiangDaoArmed);
  const lastClickRef = useRef<{ tileId: string; time: number } | null>(null);
  const pointerStartRef = useRef<{ tileId: string; x: number; y: number } | null>(null);
  const swipeDiscardedRef = useRef(false);
  const tileElementRefs = useRef(new Map<string, HTMLButtonElement>());
  const tileContentRefs = useRef(new Map<string, HTMLDivElement>());
  const previousTileRects = useRef(new Map<string, DOMRect>());
  const previousLayoutKey = useRef("");

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
  const layoutKey = tiles.map((tile) => tile.id).join("|");
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
  const liangDaoDiscardTileIds = tingTileIds;
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

  useEffect(() => {
    if (liangDaoArmed && (!interactive || human.isLiangDao || revealAll || liangDaoDiscardTileIds.size === 0)) {
      setLiangDaoArmed(false);
    }
  }, [human.isLiangDao, interactive, liangDaoArmed, liangDaoDiscardTileIds.size, revealAll, setLiangDaoArmed]);

  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();
    const layoutChanged = previousLayoutKey.current !== "" && previousLayoutKey.current !== layoutKey;

    for (const tile of tiles) {
      const element = tileElementRefs.current.get(tile.id);
      if (!element) continue;

      const nextRect = element.getBoundingClientRect();
      const previousRect = previousTileRects.current.get(tile.id);
      const contentElement = tileContentRefs.current.get(tile.id);
      nextRects.set(tile.id, nextRect);

      if (!layoutChanged || !previousRect || !contentElement) continue;
      const deltaX = previousRect.left - nextRect.left;
      if (Math.abs(deltaX) < 1) continue;

      contentElement.animate(
        [
          { transform: `translateX(${deltaX}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: HAND_REORDER_ANIMATION_MS,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    }

    previousTileRects.current = nextRects;
    previousLayoutKey.current = layoutKey;
  }, [layoutKey, tiles]);

  if (human.hand.length === 0 || human.isLiangDao || revealAll) return null;

  function playTile(tileId: string, canLiangDaoWithTile: boolean) {
    if (!interactive) return;
    if (liangDaoArmed) {
      if (canLiangDaoWithTile) {
        setLiangDaoArmed(false);
        declareLiangDao("human", tileId);
        return;
      }
      setLiangDaoArmed(false);
      discardTile("human", tileId);
      return;
    }
    discardTile("human", tileId);
  }

  function handleTileClick(tileId: string, canLiangDaoWithTile: boolean) {
    if (swipeDiscardedRef.current) {
      swipeDiscardedRef.current = false;
      return;
    }
    const now = window.performance.now();
    const previous = lastClickRef.current;
    const isDoubleTap = previous?.tileId === tileId && now - previous.time <= DOUBLE_TAP_MS;
    lastClickRef.current = { tileId, time: now };
    selectTile(tileId);
    if (isDoubleTap) {
      lastClickRef.current = null;
      playTile(tileId, canLiangDaoWithTile);
    }
  }

  function handleTilePointerDown(event: React.PointerEvent<HTMLButtonElement>, tileId: string) {
    event.stopPropagation();
    if (!interactive || !isMobileLandscape) {
      pointerStartRef.current = null;
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerStartRef.current = { tileId, x: event.clientX, y: event.clientY };
    swipeDiscardedRef.current = false;
  }

  function handleTilePointerUp(
    event: React.PointerEvent<HTMLButtonElement>,
    tileId: string,
    canLiangDaoWithTile: boolean,
  ) {
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || start.tileId !== tileId || !interactive || !isMobileLandscape) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (dy <= -SWIPE_DISCARD_MIN_DY && Math.abs(dx) <= SWIPE_DISCARD_MAX_DX) {
      swipeDiscardedRef.current = true;
      lastClickRef.current = null;
      selectTile(tileId);
      playTile(tileId, canLiangDaoWithTile);
      window.setTimeout(() => {
        swipeDiscardedRef.current = false;
      }, 0);
    }
  }

  function handleTilePointerCancel(event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    pointerStartRef.current = null;
  }

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
          const canLiangDaoWithTile = liangDaoDiscardTileIds.has(tile.id);
          const highlightLiangDaoChoice = liangDaoArmed && canLiangDaoWithTile;

          return (
            <button
              ref={(element) => {
                if (element) tileElementRefs.current.set(tile.id, element);
                else tileElementRefs.current.delete(tile.id);
              }}
              key={tile.id}
              type="button"
              title={label}
              aria-label={label}
              onPointerDown={(event) => handleTilePointerDown(event, tile.id)}
              onPointerUp={(event) => handleTilePointerUp(event, tile.id, canLiangDaoWithTile)}
              onPointerCancel={handleTilePointerCancel}
              onClick={() => handleTileClick(tile.id, canLiangDaoWithTile)}
              onMouseEnter={() => {
                if (interactive) setHoveredTileId(tile.id);
              }}
              onMouseLeave={() => {
                if (interactive) setHoveredTileId(undefined);
              }}
              className={`relative shrink-0 overflow-visible rounded-lg bg-transparent transition ${
                isMobileLandscape ? "h-[84px] w-[57px]" : "h-[126px] w-[86px] sm:h-[138px] sm:w-[94px]"
              } ${isDrawn ? "human-hand-tile--enter" : ""} ${
                isDrawn ? DRAWN_TILE_GAP_CLASS : ""
              } ${
                selected
                  ? `${isMobileLandscape ? "-translate-y-2" : "-translate-y-3"} shadow-[0_14px_28px_rgba(250,204,21,0.26),0_0_18px_rgba(250,204,21,0.28)]`
                  : highlightLiangDaoChoice
                    ? "shadow-[0_12px_24px_rgba(56,189,248,0.26),0_0_16px_rgba(56,189,248,0.32)]"
                  : canPengTile
                    ? "shadow-[0_12px_24px_rgba(250,204,21,0.22),0_0_14px_rgba(250,204,21,0.24)]"
                  : dangerous
                    ? "shadow-[0_12px_24px_rgba(239,68,68,0.22),0_0_14px_rgba(239,68,68,0.22)]"
                  : "shadow-panel"
              } ${interactive ? `pointer-events-auto cursor-pointer ${isMobileLandscape ? "hover:-translate-y-2" : "hover:-translate-y-4"}` : "pointer-events-auto cursor-default"}`}
            >
              <div
                ref={(element) => {
                  if (element) tileContentRefs.current.set(tile.id, element);
                  else tileContentRefs.current.delete(tile.id);
                }}
                className="pointer-events-none relative h-full w-full overflow-visible"
              >
                {selected || highlightLiangDaoChoice || canPengTile || dangerous ? (
                  <span
                    className={`absolute inset-x-3 -bottom-1 z-10 h-1 origin-center rounded-full blur-[0.5px] ${
                      dangerous ? "bg-red-400/85" : highlightLiangDaoChoice ? "bg-sky-300/90" : "bg-yellow-300/90"
                    } ${canPengTile ? "human-hand-tile-glow--pulse" : ""}`}
                  />
                ) : null}
                <Image
                  src={frontTileFace}
                  alt=""
                  fill
                  sizes={isMobileLandscape ? "57px" : "94px"}
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
                      isMobileLandscape ? "h-[56px] w-[40px]" : "h-[84px] w-[60px] sm:h-[92px] sm:w-[66px]"
                    }`}
                    unoptimized
                    priority
                    loading="eager"
                  />
                ) : null}
                {tingTileIds.has(tile.id) ? (
                  <span className="absolute left-1/2 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.9)]" />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
