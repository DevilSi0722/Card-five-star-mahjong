"use client";

import { useEffect, useRef } from "react";
import type { Player, PlayerId } from "@/types/mahjong";
import { TileMesh } from "./TileMesh";

function baseForSeat(seat: Player["seat"]): [number, number, number] {
  if (seat === "bottom") return [-2.15, 0.18, 1.52];
  if (seat === "left") return [-3.32, 0.18, -1.95];
  return [3.32, 0.18, -1.95];
}

function tilePosition(
  seat: Player["seat"],
  base: [number, number, number],
  meldIndex: number,
  tileIndex: number,
): [number, number, number] {
  if (seat === "bottom") return [base[0] + meldIndex * 1.02 + tileIndex * 0.25, base[1], base[2]];
  if (seat === "left") return [base[0], base[1], base[2] + meldIndex * 0.72 + tileIndex * 0.2];
  return [base[0], base[1], base[2] + meldIndex * 0.72 + tileIndex * 0.2];
}

function stackedGangTilePosition(
  seat: Player["seat"],
  base: [number, number, number],
  meldIndex: number,
  tileIndex: number,
): [number, number, number] {
  const visualTileIndex = tileIndex === 3 ? 1 : tileIndex;
  const position = tilePosition(seat, base, meldIndex, visualTileIndex);
  if (tileIndex === 3) return [position[0], position[1] + 0.1, position[2]];
  return position;
}

function rotationForSeat(seat: Player["seat"]): [number, number, number] {
  if (seat === "left") return [0, Math.PI / 2, 0];
  if (seat === "right") return [0, -Math.PI / 2, 0];
  return [0, 0, 0];
}

function seatForPlayerId(playerId: PlayerId): Player["seat"] {
  if (playerId === "ai_left") return "left";
  if (playerId === "ai_right") return "right";
  return "bottom";
}

function handSourcePosition(seat: Player["seat"]): [number, number, number] {
  if (seat === "bottom") return [0, 0.42, 2.22];
  if (seat === "left") return [-2.75, 0.48, 0];
  return [2.75, 0.48, 0];
}

function discardSourcePosition(seat: Player["seat"]): [number, number, number] {
  if (seat === "bottom") return [0, 0.5, 0.92];
  if (seat === "left") return [-1.18, 0.5, -0.2];
  return [1.18, 0.5, 0.2];
}

function sourceRotationForSeat(seat: Player["seat"]): [number, number, number] {
  if (seat === "left") return [0, Math.PI / 2, 0];
  if (seat === "right") return [0, -Math.PI / 2, 0];
  return [0, 0, 0];
}

export function MeldArea3D({ player }: { player: Player }) {
  const base = baseForSeat(player.seat);
  const renderedTileKeysRef = useRef<Set<string> | null>(null);
  const currentTileKeys = player.melds.flatMap((meld) =>
    meld.tiles.map((tile) => `${meld.id}-${tile.id}`),
  );
  const newTileKeys = renderedTileKeysRef.current
    ? currentTileKeys.filter((tileKey) => !renderedTileKeysRef.current?.has(tileKey))
    : [];
  const animatedTileKeys = newTileKeys.length > 0 && newTileKeys.length <= 4 ? new Set(newTileKeys) : new Set<string>();

  useEffect(() => {
    renderedTileKeysRef.current = new Set(currentTileKeys);
  }, [currentTileKeys]);

  return (
    <group>
      {player.melds.map((meld, meldIndex) =>
        meld.tiles.map((tile, tileIndex) => {
          const tileKey = `${meld.id}-${tile.id}`;
          const concealedGang = meld.type === "an_gang" && Boolean(meld.concealed);
          const stackedGang = concealedGang || meld.type === "ming_gang" || meld.type === "bu_gang";
          const fromDiscard =
            Boolean(meld.fromPlayerId) &&
            (meld.type === "peng" || meld.type === "ming_gang") &&
            tileIndex === meld.tiles.length - 1;
          const sourceSeat = fromDiscard && meld.fromPlayerId ? seatForPlayerId(meld.fromPlayerId) : player.seat;
          const position = stackedGang
            ? stackedGangTilePosition(player.seat, base, meldIndex, tileIndex)
            : tilePosition(player.seat, base, meldIndex, tileIndex);
          const faceUp = concealedGang
            ? tileIndex === 3
            : !meld.concealed || player.id === "human" || player.isLiangDao;
          return (
            <TileMesh
              key={tileKey}
              tile={tile}
              faceUp={faceUp}
              scale={player.id === "human" ? 0.68 : 0.58}
              position={position}
              rotation={rotationForSeat(player.seat)}
              flyFrom={
                animatedTileKeys.has(tileKey)
                  ? fromDiscard
                    ? discardSourcePosition(sourceSeat)
                    : handSourcePosition(sourceSeat)
                  : undefined
              }
              flyFromRotation={sourceRotationForSeat(sourceSeat)}
            />
          );
        }),
      )}
    </group>
  );
}
