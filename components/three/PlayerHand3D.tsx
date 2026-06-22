"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Player } from "@/types/mahjong";
import { getTingDiscardTileIds } from "@/utils/mahjong/tingInfo";
import { useGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { TileKindPreview3D, TileMesh } from "./TileMesh";
import {
  lyingRotationForSeat,
  playerHandTransform,
  revealedHandOffset,
  standingHandOffset,
  wallSourcePosition,
  type HandTransform,
} from "./tableSceneLayout";

// 新摸牌与已有手牌之间额外留出的间隔（以一个牌位的比例表示）
const DRAWN_TILE_GAP = 0.55;

function waitingPreviewPosition(
  seat: Player["seat"],
  transform: HandTransform,
  index: number,
  count: number,
  scale: number,
): [number, number, number] {
  const offset = (index - (count - 1) / 2) * 0.26 * scale;
  if (seat === "left") return [transform.center[0] + 0.38, 0.2, transform.center[2] + offset];
  if (seat === "right") return [transform.center[0] - 0.38, 0.2, transform.center[2] - offset];
  return [transform.center[0] + offset, 0.2, transform.center[2] - 0.38];
}

export function PlayerHand3D({
  player,
  current,
  revealAll,
  selectedTileId,
  visibleTileCount,
  scale = 1,
  compact = false,
  onTileClick,
  onTileDoubleClick,
  showWaitingPreview = false,
}: {
  player: Player;
  current?: boolean;
  revealAll?: boolean;
  selectedTileId?: string;
  visibleTileCount?: number;
  scale?: number;
  compact?: boolean;
  onTileClick?: (tileId: string) => void;
  onTileDoubleClick?: (tileId: string) => void;
  showWaitingPreview?: boolean;
}) {
  const transform = playerHandTransform(player.seat, compact);
  const shownCount = Math.min(
    player.hand.length,
    typeof visibleTileCount === "number" ? Math.max(0, visibleTileCount) : player.hand.length,
  );
  const shownHand = player.hand.slice(0, shownCount);
  const renderedTileIdsRef = useRef<Set<string> | null>(null);
  const isHuman = player.id === "human";
  // 结算/流局时所有玩家全亮牌
  const revealAllTiles = Boolean(revealAll);
  // 亮倒：手牌亮出平铺；扣住的暗刻移到副露区显示
  const isLiangDao = player.isLiangDao && !revealAllTiles;
  const liangDaoHiddenTileIds = useMemo(
    () => new Set(player.liangDaoHiddenTileIds ?? []),
    [player.liangDaoHiddenTileIds],
  );
  const visibleHand = isLiangDao ? shownHand.filter((tile) => !liangDaoHiddenTileIds.has(tile.id)) : shownHand;
  const currentTileIds = visibleHand.map((tile) => tile.id);
  const newTileIds = renderedTileIdsRef.current
    ? currentTileIds.filter((tileId) => !renderedTileIdsRef.current?.has(tileId))
    : [];
  const animatedTileIds = newTileIds.length > 0 && newTileIds.length <= 4 ? new Set(newTileIds) : new Set<string>();

  // 单张牌是否「亮出平铺」：结算全亮，或亮倒时全手牌亮出
  const isTileRevealed = () => revealAllTiles || isLiangDao;

  // 仅人类、未平放（无亮倒/结算）、且确有新摸牌时，把新摸牌单独挪到最右侧并留间隔
  const anyRevealed = revealAllTiles || isLiangDao;
  const drawnId = !anyRevealed && isHuman ? player.lastDrawnTileId : undefined;
  const hasDrawn = drawnId ? visibleHand.some((tile) => tile.id === drawnId) : false;

  const setHoveredTileId = useUiStore((state) => state.setHoveredTileId);
  const hardcoreModeEnabled = useUiStore((state) => state.hardcoreModeEnabled);
  const netRole = useGameStore((state) => state.netRole);
  const hideTingAssist = netRole === "single" && hardcoreModeEnabled;

  // 仅人类、轮到自己出牌、未亮倒时，计算「打出即可听牌」的牌，供显示黄色提示圆点
  const tingTileIds = useMemo(
    () =>
      isHuman && current && !player.isLiangDao && !hideTingAssist
        ? getTingDiscardTileIds(player.hand, player.melds)
        : new Set<string>(),
    [hideTingAssist, isHuman, current, player.isLiangDao, player.hand, player.melds],
  );

  useEffect(() => {
    renderedTileIdsRef.current = new Set(currentTileIds);
  }, [currentTileIds]);

  // 先排出“非新摸牌”的牌，再把新摸牌放到末尾（带额外间隔的槽位）
  const rest = hasDrawn ? visibleHand.filter((tile) => tile.id !== drawnId) : visibleHand;
  const drawn = hasDrawn ? visibleHand.find((tile) => tile.id === drawnId)! : undefined;
  const slots: Array<{ tile: (typeof visibleHand)[number]; slot: number }> = rest.map((tile, index) => ({
    tile,
    slot: index,
  }));
  if (drawn) slots.push({ tile: drawn, slot: rest.length + DRAWN_TILE_GAP });

  const maxSlot = slots.length > 0 ? slots[slots.length - 1].slot : 0;
  const centerSlot = maxSlot / 2;

  return (
    <group>
      {showWaitingPreview && player.isLiangDao
        ? player.waitingKinds.map((kind, index) => (
            <TileKindPreview3D
              key={`${player.id}-wait-${kind}`}
              kind={kind}
              scale={compact ? 0.46 : 0.5}
              position={waitingPreviewPosition(player.seat, transform, index, player.waitingKinds.length, scale)}
              rotation={transform.rotation}
            />
          ))
        : null}
      {slots.map(({ tile, slot }) => {
        const delta = (slot - centerSlot) * scale;
        // 该牌是否平铺亮出（结算全亮 / 亮倒全亮）
        const lying = isTileRevealed();
        const revealedOffset = lying ? revealedHandOffset(player.seat, compact) : ([0, 0, 0] as const);
        const standingOffset = !lying ? standingHandOffset(player.seat, compact) : ([0, 0, 0] as const);
        // 平铺亮出的牌一定正面；其余牌：人类看自己手牌为正面，AI 暗置
        const faceUp = lying || isHuman;
        const tileRotation = lying ? lyingRotationForSeat(player.seat) : transform.rotation;
        return (
          <TileMesh
            key={tile.id}
            tile={tile}
            faceUp={faceUp}
            selected={selectedTileId === tile.id}
            current={current}
            liangDao={lying}
            standing={!lying}
            scale={scale}
            hoverable={isHuman && !lying}
            tingHint={tingTileIds.has(tile.id)}
            position={[
              transform.center[0] + transform.step[0] * delta + revealedOffset[0] + standingOffset[0],
              transform.center[1] + revealedOffset[1] + standingOffset[1],
              transform.center[2] + transform.step[2] * delta + revealedOffset[2] + standingOffset[2],
            ]}
            rotation={tileRotation}
            flyFrom={animatedTileIds.has(tile.id) ? wallSourcePosition(player.seat) : undefined}
            flyFromRotation={tileRotation}
            onClick={isHuman ? () => onTileClick?.(tile.id) : undefined}
            onDoubleClick={isHuman ? () => onTileDoubleClick?.(tile.id) : undefined}
            onHoverChange={
              isHuman && !lying
                ? (hovered) => setHoveredTileId(hovered ? tile.id : undefined)
                : undefined
            }
          />
        );
      })}
    </group>
  );
}
