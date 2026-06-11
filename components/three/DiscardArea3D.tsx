"use client";

import type { Player } from "@/types/mahjong";
import { TileMesh } from "./TileMesh";

interface DiscardLayout {
  origin: [number, number, number];
  // 同一行内推进一张牌的位移（x, z）
  col: [number, number];
  // 换到下一行的位移（x, z），方向朝桌心，使牌堆在玩家面前由近及远展开
  row: [number, number];
  // 让牌面朝向该玩家自己的方向
  rotationY: number;
}

// 每个座位的弃牌都摆在自己面前，并朝向各自的方向横排，而非统一朝向人类
function discardLayout(seat: Player["seat"]): DiscardLayout {
  if (seat === "bottom") {
    return { origin: [-0.95, 0.26, 1.15], col: [0.31, 0], row: [0, -0.42], rotationY: 0 };
  }
  if (seat === "left") {
    // 左家坐在 -x，面朝 +x：行沿 +z 排列，逐行向桌心（+x）堆叠
    return { origin: [-1.75, 0.26, -0.95], col: [0, 0.31], row: [0.42, 0], rotationY: Math.PI / 2 };
  }
  // 右家坐在 +x，面朝 -x：行沿 -z 排列，逐行向桌心（-x）堆叠
  return { origin: [1.75, 0.26, 0.95], col: [0, -0.31], row: [-0.42, 0], rotationY: -Math.PI / 2 };
}

export function DiscardArea3D({ player }: { player: Player }) {
  const layout = discardLayout(player.seat);
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
            scale={0.82}
            position={[
              layout.origin[0] + layout.col[0] * col + layout.row[0] * row,
              layout.origin[1],
              layout.origin[2] + layout.col[1] * col + layout.row[1] * row,
            ]}
            rotation={[0, layout.rotationY, 0]}
          />
        );
      })}
    </group>
  );
}
