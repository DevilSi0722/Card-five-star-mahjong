"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { animated, useSpring } from "@react-spring/three";
import type { MeshStandardMaterial } from "three";
import type { Player, PlayerId } from "@/types/mahjong";

// 紧贴各玩家侧桌面内缘，与四角金属装饰点保持同等风格
const SEAT_POS: Record<Player["seat"], [number, number, number]> = {
  bottom: [0,    0.165,  2.55],
  left:   [-3.1, 0.165,  0  ],
  right:  [3.1,  0.165,  0  ],
};
const SEATS: Player["seat"][] = ["bottom", "left", "right"];
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

function SeatMark({ seat, isActive }: { seat: Player["seat"]; isActive: boolean }) {
  const ringMat = useRef<MeshStandardMaterial>(null);
  const dotMat  = useRef<MeshStandardMaterial>(null);

  const { scale } = useSpring({
    scale: isActive ? 1 : 0.001,
    config: { tension: 140, friction: 22 },
  });

  useFrame((state) => {
    if (!ringMat.current || !dotMat.current) return;
    if (!isActive) {
      ringMat.current.emissiveIntensity = 0;
      dotMat.current.emissiveIntensity  = 0;
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2.4);
    ringMat.current.emissiveIntensity = 0.3 + pulse * 0.5;
    dotMat.current.emissiveIntensity  = 0.6 + pulse * 0.8;
  });

  return (
    <animated.group position={SEAT_POS[seat]} rotation={FLAT} scale={scale as unknown as number}>
      {/* 外环 — 与桌角金属装饰同款 #c9a24a */}
      <mesh>
        <ringGeometry args={[0.18, 0.27, 36]} />
        <meshStandardMaterial
          ref={ringMat}
          color="#c9a24a"
          emissive="#7a5e1e"
          emissiveIntensity={0.4}
          roughness={0.4}
          metalness={0.6}
          toneMapped={false}
        />
      </mesh>
      {/* 内芯 — 与听牌圆点、选中牌高亮同款 #facc15 */}
      <mesh>
        <circleGeometry args={[0.11, 32]} />
        <meshStandardMaterial
          ref={dotMat}
          color="#facc15"
          emissive="#facc15"
          emissiveIntensity={0.6}
          roughness={0.5}
          metalness={0.3}
          transparent
          opacity={0.85}
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
}: {
  players: Record<PlayerId, Player>;
  currentPlayerId: PlayerId;
  active: boolean;
}) {
  const currentSeat = active ? (players[currentPlayerId]?.seat ?? "bottom") : null;

  return (
    <group>
      {SEATS.map((seat) => (
        <SeatMark key={seat} seat={seat} isActive={seat === currentSeat} />
      ))}
    </group>
  );
}
