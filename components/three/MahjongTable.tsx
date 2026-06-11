"use client";

import { Text } from "@react-three/drei";

// 四个座位角落的装饰点位（绕桌心对称）
const CORNER_POSITIONS: Array<[number, number]> = [
  [-3.2, -2.5],
  [3.2, -2.5],
  [-3.2, 2.5],
  [3.2, 2.5],
];

// 四向座位风位标识：按出牌顺序 东(下家/人类)→南(右家)→西(左家)，文字朝各自玩家方向平铺
const SEAT_MARKERS: Array<{ pos: [number, number, number]; rotation: [number, number, number]; label: string }> = [
  { pos: [0, 0.151, 2.05], rotation: [-Math.PI / 2, 0, 0], label: "东" },
  { pos: [2.5, 0.151, 0], rotation: [-Math.PI / 2, 0, -Math.PI / 2], label: "南" },
  { pos: [-2.5, 0.151, 0], rotation: [-Math.PI / 2, 0, Math.PI / 2], label: "西" },
];

export function MahjongTable({ wallCount }: { wallCount: number }) {
  return (
    <group>
      {/* 外层木质桌身 */}
      <mesh receiveShadow position={[0, -0.18, 0]}>
        <boxGeometry args={[8.2, 0.36, 6.6]} />
        <meshStandardMaterial color="#3a241a" roughness={0.55} metalness={0.18} />
      </mesh>

      {/* 木纹包边（高出台面的外框） */}
      <mesh receiveShadow castShadow position={[0, 0.04, 0]}>
        <boxGeometry args={[7.9, 0.18, 6.3]} />
        <meshStandardMaterial color="#5a3a26" roughness={0.5} metalness={0.22} />
      </mesh>

      {/* 深色凹槽，营造内嵌台面的层次 */}
      <mesh receiveShadow position={[0, 0.06, 0]}>
        <boxGeometry args={[7.3, 0.16, 5.7]} />
        <meshStandardMaterial color="#10302b" roughness={0.85} />
      </mesh>

      {/* 主毡面（深绿） */}
      <mesh receiveShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[7.0, 0.08, 5.4]} />
        <meshStandardMaterial color="#1f6f61" roughness={0.92} />
      </mesh>

      {/* 毡面中央更深一档的方框，分割打牌区与中心区 */}
      <mesh receiveShadow position={[0, 0.115, 0]}>
        <boxGeometry args={[3.4, 0.02, 3.0]} />
        <meshStandardMaterial color="#185a4e" roughness={0.95} />
      </mesh>

      {/* 四角金色装饰点 */}
      {CORNER_POSITIONS.map(([x, z], index) => (
        <mesh key={`corner-${index}`} position={[x, 0.13, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.12, 0.2, 24]} />
          <meshStandardMaterial color="#c9a24a" emissive="#7a5e1e" emissiveIntensity={0.4} roughness={0.4} metalness={0.6} toneMapped={false} />
        </mesh>
      ))}

      {/* 四向座位方位标识 */}
      {SEAT_MARKERS.map((marker) => (
        <Text
          key={marker.label}
          position={marker.pos}
          rotation={marker.rotation}
          fontSize={0.26}
          color="#2f8a78"
          anchorX="center"
          anchorY="middle"
        >
          {marker.label}
        </Text>
      ))}

      {/* 中心牌墙计数底座 */}
      <mesh position={[0, 0.14, 0]} castShadow>
        <boxGeometry args={[1.35, 0.12, 0.98]} />
        <meshStandardMaterial color="#0d2b27" roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.205, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.7, 40]} />
        <meshStandardMaterial color="#2f8a78" emissive="#155" emissiveIntensity={0.3} toneMapped={false} />
      </mesh>
      <Text position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.17} color="#dff7ef" anchorX="center" anchorY="middle">
        余牌 {wallCount}
      </Text>

      {/* 三向挡牌条 */}
      <mesh position={[0, 0.16, -2.35]} castShadow>
        <boxGeometry args={[4.4, 0.1, 0.22]} />
        <meshStandardMaterial color="#2b544d" roughness={0.7} />
      </mesh>
      <mesh position={[-3.05, 0.16, 0]} castShadow>
        <boxGeometry args={[0.22, 0.1, 3.5]} />
        <meshStandardMaterial color="#2b544d" roughness={0.7} />
      </mesh>
      <mesh position={[3.05, 0.16, 0]} castShadow>
        <boxGeometry args={[0.22, 0.1, 3.5]} />
        <meshStandardMaterial color="#2b544d" roughness={0.7} />
      </mesh>
    </group>
  );
}
