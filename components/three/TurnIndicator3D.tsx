"use client";

import { animated, useSpring } from "@react-spring/three";
import type { Player, PlayerId } from "@/types/mahjong";
import { playerHandTransform, type Vec3 } from "./tableSceneLayout";

const SEATS: Player["seat"][] = ["bottom", "left", "right"];

const ARROW_Y = 0.34;
const SIDE_ARROW_CENTER_OFFSET = 0.76;

function arrowPosition(seat: Player["seat"], compact: boolean): Vec3 {
  const transform = playerHandTransform(seat, compact);
  if (seat === "bottom") return [transform.center[0], ARROW_Y, transform.center[2] - 0.62];
  if (seat === "left") return [transform.center[0] + SIDE_ARROW_CENTER_OFFSET, ARROW_Y, transform.center[2]];
  return [transform.center[0] - SIDE_ARROW_CENTER_OFFSET, ARROW_Y, transform.center[2]];
}

function arrowRotation(seat: Player["seat"]): Vec3 {
  if (seat === "left") return [0, -Math.PI / 2, 0];
  if (seat === "right") return [0, Math.PI / 2, 0];
  return [0, 0, 0];
}

function SeatArrow({ seat, isActive, compact }: { seat: Player["seat"]; isActive: boolean; compact: boolean }) {
  const { scale } = useSpring({
    scale: isActive ? 0.84 : 0.001,
    config: { tension: 140, friction: 22 },
  });

  return (
    <animated.group position={arrowPosition(seat, compact)} rotation={arrowRotation(seat)} scale={scale as unknown as number}>
      <mesh castShadow receiveShadow position={[0, 0.03, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.28, 18]} />
        <meshStandardMaterial
          color="#f7c948"
          emissive="#d99516"
          emissiveIntensity={0.5}
          roughness={0.32}
          metalness={0.44}
          toneMapped={false}
        />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.03, 0.27]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.13, 0.2, 24]} />
        <meshStandardMaterial
          color="#ffd166"
          emissive="#facc15"
          emissiveIntensity={0.7}
          roughness={0.26}
          metalness={0.48}
          toneMapped={false}
        />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.03, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.085, 0.085, 0.035, 20]} />
        <meshStandardMaterial
          color="#fff0a8"
          emissive="#f5b942"
          emissiveIntensity={0.35}
          roughness={0.24}
          metalness={0.55}
          toneMapped={false}
        />
      </mesh>
    </animated.group>
  );
}

export function TurnIndicator3D({
  players,
  currentPlayerId,
  active,
  compact = false,
}: {
  players: Record<PlayerId, Player>;
  currentPlayerId: PlayerId;
  active: boolean;
  compact?: boolean;
}) {
  const currentSeat = active ? (players[currentPlayerId]?.seat ?? "bottom") : null;

  return (
    <group>
      {SEATS.map((seat) => (
        <SeatArrow key={seat} seat={seat} isActive={seat === currentSeat} compact={compact} />
      ))}
    </group>
  );
}
