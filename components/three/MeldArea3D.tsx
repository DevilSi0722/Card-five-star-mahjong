"use client";

import type { Player } from "@/types/mahjong";
import { TileMesh } from "./TileMesh";

function baseForSeat(seat: Player["seat"]): [number, number, number] {
  if (seat === "bottom") return [-2.15, 0.18, 1.52];
  if (seat === "left") return [-3.02, 0.18, -1.95];
  return [3.02, 0.18, 1.95];
}

function tilePosition(
  seat: Player["seat"],
  base: [number, number, number],
  meldIndex: number,
  tileIndex: number,
): [number, number, number] {
  if (seat === "bottom") return [base[0] + meldIndex * 1.02 + tileIndex * 0.25, base[1], base[2]];
  if (seat === "left") return [base[0], base[1], base[2] + meldIndex * 0.72 + tileIndex * 0.2];
  return [base[0], base[1], base[2] - meldIndex * 0.72 - tileIndex * 0.2];
}

function rotationForSeat(seat: Player["seat"]): [number, number, number] {
  if (seat === "left") return [0, Math.PI / 2, 0];
  if (seat === "right") return [0, -Math.PI / 2, 0];
  return [0, 0, 0];
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
            scale={player.id === "human" ? 0.68 : 0.58}
            position={tilePosition(player.seat, base, meldIndex, tileIndex)}
            rotation={rotationForSeat(player.seat)}
          />
        )),
      )}
    </group>
  );
}
