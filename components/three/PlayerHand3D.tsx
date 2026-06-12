"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Player } from "@/types/mahjong";
import { getTingDiscardTileIds } from "@/utils/mahjong/tingInfo";
import { useUiStore } from "@/store/uiStore";
import { TileKindPreview3D, TileMesh } from "./TileMesh";

function handTransform(seat: Player["seat"], compact: boolean) {
  const bottom = compact
    ? { center: [0, 0.24, 2.1] as const, step: [0.32, 0, 0] as const }
    : { center: [0, 0.24, 2.05] as const, step: [0.36, 0, 0] as const };
  const side = compact
    ? { center: [-2.56, 0.24, 0] as const, step: [0, 0, 0.29] as const }
    : { center: [-2.75, 0.24, 0] as const, step: [0, 0, 0.34] as const };
  const right = compact
    ? { center: [2.56, 0.24, 0] as const, step: [0, 0, -0.29] as const }
    : { center: [2.75, 0.24, 0] as const, step: [0, 0, -0.34] as const };

  if (seat === "bottom") return { ...bottom, rotation: [0, 0, 0] as [number, number, number] };
  if (seat === "left") return { ...side, rotation: [0, Math.PI / 2, 0] as [number, number, number] };
  return { ...right, rotation: [0, -Math.PI / 2, 0] as [number, number, number] };
}

function lyingRotationForSeat(seat: Player["seat"]): [number, number, number] {
  if (seat === "left") return [0, -Math.PI / 2, 0];
  if (seat === "right") return [0, Math.PI / 2, 0];
  return [0, 0, 0];
}

function wallSourcePosition(seat: Player["seat"]): [number, number, number] {
  if (seat === "left") return [-1.7, 0.55, -1.15];
  if (seat === "right") return [1.7, 0.55, 1.15];
  return [0, 0.55, 1.15];
}

// 新摸牌与已有手牌之间额外留出的间隔（以一个牌位的比例表示）
const DRAWN_TILE_GAP = 0.55;

function waitingPreviewPosition(
  seat: Player["seat"],
  transform: ReturnType<typeof handTransform>,
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
  scale?: number;
  compact?: boolean;
  onTileClick?: (tileId: string) => void;
  onTileDoubleClick?: (tileId: string) => void;
  showWaitingPreview?: boolean;
}) {
  const transform = handTransform(player.seat, compact);
  const renderedTileIdsRef = useRef<Set<string> | null>(null);
  const currentTileIds = player.hand.map((tile) => tile.id);
  const newTileIds = renderedTileIdsRef.current
    ? currentTileIds.filter((tileId) => !renderedTileIdsRef.current?.has(tileId))
    : [];
  const animatedTileIds = newTileIds.length > 0 && newTileIds.length <= 4 ? new Set(newTileIds) : new Set<string>();
  const isHuman = player.id === "human";
  // 结算/流局时所有玩家全亮牌
  const revealAllTiles = Boolean(revealAll);
  // 亮倒：全手牌亮出平铺
  const isLiangDao = player.isLiangDao && !revealAllTiles;

  // 单张牌是否「亮出平铺」：结算全亮，或亮倒时全手牌亮出
  const isTileRevealed = () => revealAllTiles || isLiangDao;

  // 仅人类、未平放（无亮倒/结算）、且确有新摸牌时，把新摸牌单独挪到最右侧并留间隔
  const anyRevealed = revealAllTiles || isLiangDao;
  const drawnId = !anyRevealed && isHuman ? player.lastDrawnTileId : undefined;
  const hasDrawn = drawnId ? player.hand.some((tile) => tile.id === drawnId) : false;

  const setHoveredTileId = useUiStore((state) => state.setHoveredTileId);

  // 仅人类、轮到自己出牌、未亮倒时，计算「打出即可听牌」的牌，供显示黄色提示圆点
  const tingTileIds = useMemo(
    () =>
      isHuman && current && !player.isLiangDao
        ? getTingDiscardTileIds(player.hand, player.melds)
        : new Set<string>(),
    [isHuman, current, player.isLiangDao, player.hand, player.melds],
  );

  useEffect(() => {
    renderedTileIdsRef.current = new Set(currentTileIds);
  }, [currentTileIds]);

  // 先排出“非新摸牌”的牌，再把新摸牌放到末尾（带额外间隔的槽位）
  const rest = hasDrawn ? player.hand.filter((tile) => tile.id !== drawnId) : player.hand;
  const drawn = hasDrawn ? player.hand.find((tile) => tile.id === drawnId)! : undefined;
  const slots: Array<{ tile: (typeof player.hand)[number]; slot: number }> = rest.map((tile, index) => ({
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
              transform.center[0] + transform.step[0] * delta,
              transform.center[1],
              transform.center[2] + transform.step[2] * delta,
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
