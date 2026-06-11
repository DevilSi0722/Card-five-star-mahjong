"use client";

import type { Player } from "@/types/mahjong";
import { TileMesh } from "./TileMesh";

function baseForSeat(seat: Player["seat"]): [number, number, number] {
  if (seat === "bottom") return [-2.7, 0.29, 2.72];
  if (seat === "left") return [-3.25, 0.29, 1.05];
  return [3.25, 0.29, -1.05];
}

export function MeldArea3D({ player }: { player: Player }) {
  const base = baseForSeat(player.seat);
  return (
    <group>
      {player.melds.map((meld, meldIndex) =>
        meld.tiles.map((tile, tileIndex) => (
          <TileMesh
            key={`${meld.id}-${tile.id}`}
            tile={tile}
            faceUp={!meld.concealed || player.id === "human" || player.isLiangDao}
            scale={0.78}
            position={[
              base[0] + (player.seat === "bottom" ? meldIndex * 1.16 + tileIndex * 0.29 : 0),
              base[1],
              base[2] + (player.seat === "bottom" ? 0 : meldIndex * 0.58 + tileIndex * 0.29),
            ]}
            rotation={player.seat === "left" ? [0, Math.PI / 2, 0] : player.seat === "right" ? [0, -Math.PI / 2, 0] : [0, 0, 0]}
          />
        )),
      )}
    </group>
  );
}
