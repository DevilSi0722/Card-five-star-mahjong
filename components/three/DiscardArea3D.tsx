"use client";

import { useEffect, useRef } from "react";
import type { Player } from "@/types/mahjong";
import { TileMesh } from "./TileMesh";

interface DiscardLayout {
  origin: [number, number, number];
  // 同一行内推进一张牌的位移（x, z）
  col: [number, number];
  // 换到下一行的位移（x, z），方向远离桌心，使牌堆由内向外展开
  row: [number, number];
  // 让牌面朝向该玩家自己的方向
  rotationY: number;
}

// 每个座位的弃牌都摆在自己面前，并朝向各自的方向横排，而非统一朝向人类
function discardLayout(seat: Player["seat"]): DiscardLayout {
  if (seat === "bottom") {
    return { origin: [-0.82, 0.25, 0.68], col: [0.25, 0], row: [0, 0.32], rotationY: 0 };
  }
  if (seat === "left") {
    // 左家坐在 -x，面朝 +x：从靠近桌心处开始，逐行向左家方向展开
    return { origin: [-0.98, 0.25, -0.82], col: [0, 0.25], row: [-0.32, 0], rotationY: -Math.PI / 2 };
  }
  // 右家坐在 +x，面朝 -x：从靠近桌心处开始，逐行向右家方向展开
  return { origin: [0.98, 0.25, 0.82], col: [0, -0.25], row: [0.32, 0], rotationY: Math.PI / 2 };
}

function handSourcePosition(seat: Player["seat"]): [number, number, number] {
  if (seat === "bottom") return [0, 0.42, 2.22];
  if (seat === "left") return [-2.75, 0.48, 0];
  return [2.75, 0.48, 0];
}

function handSourceRotation(seat: Player["seat"]): [number, number, number] {
  if (seat === "left") return [0, Math.PI / 2, 0];
  if (seat === "right") return [0, -Math.PI / 2, 0];
  return [0, 0, 0];
}

export function DiscardArea3D({ player }: { player: Player }) {
  const layout = discardLayout(player.seat);
  const renderedTileIdsRef = useRef<Set<string> | null>(null);
  const currentTileIds = player.discards.map((tile) => tile.id);
  const animatedTileIds = renderedTileIdsRef.current
    ? new Set(currentTileIds.filter((tileId) => !renderedTileIdsRef.current?.has(tileId)))
    : new Set<string>();

  useEffect(() => {
    renderedTileIdsRef.current = new Set(currentTileIds);
  }, [currentTileIds]);

  return (
    <group>
      {player.discards.slice(-18).map((tile, index) => {
        const col = index % 6;
        const row = Math.floor(index / 6);
        return (
          <TileMesh
            key={tile.id}
            tile={tile}
            faceUp
            scale={0.64}
            position={[
              layout.origin[0] + layout.col[0] * col + layout.row[0] * row,
              layout.origin[1],
              layout.origin[2] + layout.col[1] * col + layout.row[1] * row,
            ]}
            rotation={[0, layout.rotationY, 0]}
            flyFrom={animatedTileIds.has(tile.id) ? handSourcePosition(player.seat) : undefined}
            flyFromRotation={handSourceRotation(player.seat)}
          />
        );
      })}
    </group>
  );
}
