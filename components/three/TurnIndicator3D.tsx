"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { animated, useSpring } from "@react-spring/three";
import type { Group, Mesh } from "three";
import { MeshStandardMaterial } from "three";
import type { Player, PlayerId } from "@/types/mahjong";

// 各座位相对桌心的指向（绕 Y 轴旋转角度）：箭头默认指向 +z（人类/下家）
const SEAT_ANGLE: Record<Player["seat"], number> = {
  bottom: 0,
  right: Math.PI / 2,
  left: (Math.PI * 3) / 2,
};
const FULL_TURN = Math.PI * 2;
const ANGLE_EPSILON = 0.0001;

// 活动时高亮金色，非出牌阶段淡出
const ACTIVE_COLOR = "#facc15";

export function TurnIndicator3D({
  players,
  currentPlayerId,
  active,
}: {
  players: Record<PlayerId, Player>;
  currentPlayerId: PlayerId;
  active: boolean;
}) {
  const seat = players[currentPlayerId]?.seat ?? "bottom";
  const ringRef = useRef<Mesh>(null);
  const arrowRef = useRef<Group>(null);
  const haloRef = useRef<MeshStandardMaterial>(null);
  const previousSeatRef = useRef<Player["seat"]>(seat);
  const rotationTargetRef = useRef(SEAT_ANGLE[seat]);

  if (previousSeatRef.current !== seat) {
    let nextRotation = SEAT_ANGLE[seat];
    while (nextRotation <= rotationTargetRef.current + ANGLE_EPSILON) {
      nextRotation += FULL_TURN;
    }
    previousSeatRef.current = seat;
    rotationTargetRef.current = nextRotation;
  }

  // 平滑摆动到当前出牌玩家方向；非出牌阶段整体缩小淡出
  const spring = useSpring({
    rotationY: rotationTargetRef.current,
    scale: active ? 1 : 0.001,
    config: { tension: 170, friction: 22 },
  });

  // 旋转光环 + 呼吸式明暗，提示「正在等待该玩家出牌」
  useFrame((state, delta) => {
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.9;
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 3.2));
    if (haloRef.current) haloRef.current.emissiveIntensity = pulse * 1.6;
    if (arrowRef.current) {
      arrowRef.current.position.y = 0.34 + Math.sin(state.clock.elapsedTime * 3.2) * 0.025;
    }
  });

  return (
    <animated.group
      position={[0, 0.5, 0]}
      scale={spring.scale as unknown as number}
    >
      {/* 旋转光环 */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[0.34, 0.46, 48]} />
        <meshStandardMaterial
          color={ACTIVE_COLOR}
          emissive={ACTIVE_COLOR}
          emissiveIntensity={0.8}
          transparent
          opacity={0.55}
          toneMapped={false}
        />
      </mesh>

      {/* 指向当前出牌玩家的箭头 */}
      <animated.group rotation-y={spring.rotationY as unknown as number}>
        <group ref={arrowRef} position={[0, 0.34, 0]}>
          <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[0.17, 0.34, 4]} />
            <meshStandardMaterial
              ref={haloRef}
              color={ACTIVE_COLOR}
              emissive={ACTIVE_COLOR}
              emissiveIntensity={1.2}
              metalness={0.4}
              roughness={0.3}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0, 0.24]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <boxGeometry args={[0.1, 0.32, 0.1]} />
            <meshStandardMaterial
              color={ACTIVE_COLOR}
              emissive={ACTIVE_COLOR}
              emissiveIntensity={0.7}
              metalness={0.4}
              roughness={0.35}
              toneMapped={false}
            />
          </mesh>
        </group>
      </animated.group>
    </animated.group>
  );
}
