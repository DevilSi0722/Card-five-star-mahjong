"use client";

import { RoundedBox, useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { MirroredRepeatWrapping, SRGBColorSpace } from "three";
import frameTextureImage from "@/png/table/20260709_150122_2.png";
import type { TableclothId } from "@/store/uiStore";
import { getTableclothOption } from "@/utils/tablecloths";

const FRAME_RAILS: Array<{
  position: [number, number, number];
  size: [number, number, number];
  repeat: [number, number];
  textureRotation: number;
}> = [
  { position: [0, 0.095, -3.08], size: [8.06, 0.17, 0.42], repeat: [2.2, 0.78], textureRotation: Math.PI / 2 },
  { position: [0, 0.095, 3.08], size: [8.06, 0.17, 0.42], repeat: [2.2, 0.78], textureRotation: Math.PI / 2 },
  { position: [-3.9, 0.095, 0], size: [0.42, 0.17, 5.76], repeat: [0.78, 1.8], textureRotation: 0 },
  { position: [3.9, 0.095, 0], size: [0.42, 0.17, 5.76], repeat: [0.78, 1.8], textureRotation: 0 },
];

const INNER_TRIMS: Array<{ position: [number, number, number]; size: [number, number, number] }> = [
  { position: [0, 0.19, -2.91], size: [7.44, 0.025, 0.055] },
  { position: [0, 0.19, 2.91], size: [7.44, 0.025, 0.055] },
  { position: [-3.71, 0.19, 0], size: [0.055, 0.025, 5.78] },
  { position: [3.71, 0.19, 0], size: [0.055, 0.025, 5.78] },
];

function TableSurfaceImage({ tableclothId }: { tableclothId: TableclothId }) {
  const tablecloth = getTableclothOption(tableclothId);
  const texture = useTexture(tablecloth.texture.src);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;

  return (
    <mesh receiveShadow position={[0, 0.147, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[7.38, 5.78]} />
      <meshStandardMaterial map={texture} roughness={0.82} toneMapped={false} />
    </mesh>
  );
}

function TableFrameMaterial({
  repeat,
  textureRotation = 0,
  color = "#f1f3f2",
  roughness = 0.44,
  metalness = 0.06,
  bumpScale = 0.018,
  clearcoat = 0.36,
}: {
  repeat: [number, number];
  textureRotation?: number;
  color?: string;
  roughness?: number;
  metalness?: number;
  bumpScale?: number;
  clearcoat?: number;
}) {
  const [repeatX, repeatY] = repeat;
  const sourceTexture = useTexture(frameTextureImage.src);
  const texture = useMemo(() => {
    const clonedTexture = sourceTexture.clone();
    clonedTexture.colorSpace = SRGBColorSpace;
    clonedTexture.wrapS = MirroredRepeatWrapping;
    clonedTexture.wrapT = MirroredRepeatWrapping;
    clonedTexture.repeat.set(repeatX, repeatY);
    clonedTexture.center.set(0.5, 0.5);
    clonedTexture.rotation = textureRotation;
    clonedTexture.anisotropy = 16;
    clonedTexture.needsUpdate = true;
    return clonedTexture;
  }, [repeatX, repeatY, sourceTexture, textureRotation]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <meshPhysicalMaterial
      map={texture}
      bumpMap={texture}
      bumpScale={bumpScale}
      color={color}
      roughness={roughness}
      metalness={metalness}
      clearcoat={clearcoat}
      clearcoatRoughness={0.28}
      sheen={0.2}
      sheenColor="#65757a"
      sheenRoughness={0.72}
      emissive="#0a0e10"
      emissiveIntensity={0.16}
      toneMapped={false}
    />
  );
}

export function MahjongTable({ textured = true, tableclothId = "table" }: { textured?: boolean; tableclothId?: TableclothId }) {
  return (
    <group>
      {/* 深黑木纹底座，降低对不同桌布色相的干扰。 */}
      <RoundedBox receiveShadow castShadow position={[0, -0.18, 0]} args={[8.28, 0.36, 6.68]} radius={0.1} smoothness={4}>
        <TableFrameMaterial repeat={[1.65, 1.3]} color="#dde1df" roughness={0.58} bumpScale={0.012} clearcoat={0.24} />
      </RoundedBox>

      {/* 外框下层阴影，让桌框看起来是内嵌托盘而不是一整块板。 */}
      <RoundedBox receiveShadow castShadow position={[0, -0.01, 0]} args={[8.1, 0.18, 6.5]} radius={0.075} smoothness={4}>
        <TableFrameMaterial repeat={[1.8, 1.35]} color="#e9ecea" roughness={0.5} bumpScale={0.014} clearcoat={0.3} />
      </RoundedBox>

      {/* 四条独立木纹边框形成真实留边，避免大面积纯色压住桌布。 */}
      {FRAME_RAILS.map(({ position, size, repeat, textureRotation }, index) => (
        <RoundedBox key={`frame-rail-${index}`} receiveShadow castShadow position={position} args={size} radius={0.055} smoothness={4}>
          <TableFrameMaterial repeat={repeat} textureRotation={textureRotation} />
        </RoundedBox>
      ))}

      {/* 枪灰色内沿只接高光，不抢桌布图案。 */}
      {INNER_TRIMS.map(({ position, size }, index) => (
        <mesh key={`inner-trim-${index}`} receiveShadow castShadow position={position}>
          <boxGeometry args={size} />
          <meshPhysicalMaterial
            color="#263033"
            roughness={0.24}
            metalness={0.68}
            clearcoat={0.52}
            clearcoatRoughness={0.2}
          />
        </mesh>
      ))}

      {/* 内凹暗槽承托桌布，边缘阴影增强厚度。 */}
      <mesh receiveShadow position={[0, 0.055, 0]}>
        <boxGeometry args={[7.52, 0.13, 5.92]} />
        <meshStandardMaterial color="#0b1116" roughness={0.86} metalness={0.18} />
      </mesh>

      {/* 主桌面 */}
      <mesh receiveShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[7.38, 0.08, 5.78]} />
        <meshStandardMaterial color="#0e151b" roughness={0.9} metalness={0.08} />
      </mesh>
      {textured ? <TableSurfaceImage tableclothId={tableclothId} /> : null}
    </group>
  );
}
