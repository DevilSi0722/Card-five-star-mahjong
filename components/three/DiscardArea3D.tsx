"use client";

import { useEffect, useRef } from "react";
import type { Player } from "@/types/mahjong";
import { TileMesh } from "./TileMesh";
import { discardLayout, handSourcePosition, handSourceRotation } from "./tableSceneLayout";

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
