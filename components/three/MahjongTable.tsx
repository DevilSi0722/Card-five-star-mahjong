"use client";

import { useTexture, Text } from "@react-three/drei";
import { SRGBColorSpace } from "three";
import tableTextureSrc from "@/png/table/table.png";

// 四个座位角落的装饰点位（绕桌心对称）
const CORNER_POSITIONS: Array<[number, number]> = [
  [-3.2, -2.5],
  [3.2, -2.5],
  [-3.2, 2.5],
  [3.2, 2.5],
];

const TABLE_FONT_URL = "/fonts/MaShanZheng-Regular.ttf";

// 四向座位风位标识：按座位方位显示，文字朝各自玩家方向平铺
const SEAT_MARKERS: Array<{ pos: [number, number, number]; rotation: [number, number, number]; label: string }> = [
  { pos: [0, 0.171, 2.12], rotation: [-Math.PI / 2, 0, 0], label: "南" },
  { pos: [2.58, 0.171, 0], rotation: [-Math.PI / 2, 0, -Math.PI / 2], label: "东" },
  { pos: [0, 0.171, -2.12], rotation: [-Math.PI / 2, 0, Math.PI], label: "北" },
  { pos: [-2.58, 0.171, 0], rotation: [-Math.PI / 2, 0, Math.PI / 2], label: "西" },
];

function TableSurfaceImage() {
  const texture = useTexture(tableTextureSrc.src);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;

  return (
    <mesh receiveShadow position={[0, 0.147, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[7.38, 5.78]} />
      <meshStandardMaterial map={texture} roughness={0.82} toneMapped={false} />
    </mesh>
  );
}

export function MahjongTable({ textured = true }: { textured?: boolean }) {
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

      {/* 主桌面 */}
      <mesh receiveShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[7.38, 0.08, 5.78]} />
        <meshStandardMaterial color="#1f1612" roughness={0.92} />
      </mesh>
      {textured ? <TableSurfaceImage /> : null}

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
          font={TABLE_FONT_URL}
          fontSize={0.38}
          color="#F8C887"
          anchorX="center"
          anchorY="middle"
        >
          {marker.label}
        </Text>
      ))}
    </group>
  );
}
