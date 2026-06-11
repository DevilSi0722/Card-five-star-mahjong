"use client";

import { Suspense, useMemo, useState } from "react";
import { useTexture } from "@react-three/drei";
import { animated, useSpring } from "@react-spring/three";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { TileInstance, TileKind } from "@/types/mahjong";
import { getTileTextureSrc } from "@/utils/mahjong/tileTextures";

interface TileMeshProps {
  tile?: TileInstance;
  faceUp?: boolean;
  position: [number, number, number];
  rotation?: [number, number, number];
  selected?: boolean;
  current?: boolean;
  liangDao?: boolean;
  standing?: boolean;
  hoverable?: boolean;
  tingHint?: boolean;
  scale?: number;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

const FACE_BACKGROUND = "#f5f1df";
const FACE_TEXTURE_CACHE = new WeakMap<object, CanvasTexture>();

function TileFaceTexture({ src, standing = false }: { src: string; standing?: boolean }) {
  const sourceTexture = useTexture(src);
  const texture = useMemo(() => {
    const sourceImage = sourceTexture.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
    if (!sourceImage) return sourceTexture;
    const cached = FACE_TEXTURE_CACHE.get(sourceImage);
    if (cached) return cached;

    const width = sourceImage.width;
    const height = sourceImage.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return sourceTexture;
    context.fillStyle = FACE_BACKGROUND;
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceImage, 0, 0, width, height);

    const bakedTexture = new CanvasTexture(canvas);
    bakedTexture.colorSpace = SRGBColorSpace;
    bakedTexture.anisotropy = 16;
    bakedTexture.needsUpdate = true;
    FACE_TEXTURE_CACHE.set(sourceImage, bakedTexture);
    return bakedTexture;
  }, [sourceTexture]);

  return standing ? (
    <mesh position={[0, 0, 0.0605]} rotation={[0, 0, 0]}>
      <planeGeometry args={[0.255, 0.355]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  ) : (
    <mesh position={[0, 0.0605, 0.01]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.255, 0.355]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

// 听牌提示：牌正上方悬浮的黄色圆点
function TingDot({ standing }: { standing: boolean }) {
  const y = standing ? 0.46 : 0.18;
  const z = standing ? 0.02 : 0;
  return (
    <mesh position={[0, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.07, 24]} />
      <meshBasicMaterial color="#facc15" toneMapped={false} />
    </mesh>
  );
}

export function TileMesh({
  tile,
  faceUp = true,
  position,
  rotation = [0, 0, 0],
  selected = false,
  current = false,
  liangDao = false,
  standing = false,
  hoverable = false,
  tingHint = false,
  scale = 1,
  onClick,
  onDoubleClick,
  onHoverChange,
}: TileMeshProps) {
  const isStanding = standing && !liangDao;
  const [hovered, setHovered] = useState(false);
  // 仅悬浮才抬升（双击打出）；单击仅作选中（用于亮倒选张），不再「拿起」抬升
  const spring = useSpring({
    position: [
      position[0],
      position[1] + (isStanding ? 0.25 : 0) + (hovered ? 0.16 : 0),
      position[2],
    ] as [number, number, number],
    rotation,
    config: { tension: 260, friction: 24 },
  });

  const textureSrc = tile && faceUp ? getTileTextureSrc(tile.kind) : undefined;

  function setHover(next: boolean) {
    if (!hoverable) return;
    setHovered(next);
    onHoverChange?.(next);
    if (typeof document !== "undefined") {
      document.body.style.cursor = next ? "pointer" : "auto";
    }
  }

  return (
    <animated.group
      position={spring.position as unknown as [number, number, number]}
      rotation={spring.rotation as unknown as [number, number, number]}
      scale={scale}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onDoubleClick?.();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHover(true);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        setHover(false);
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={isStanding ? [0.34, 0.5, 0.12] : [0.34, 0.12, 0.5]} />
        <meshStandardMaterial
          color={faceUp ? "#f5f1df" : "#235b78"}
          emissive={selected ? "#facc15" : "#000000"}
          emissiveIntensity={selected ? 0.45 : 0}
          roughness={0.55}
        />
      </mesh>
      {textureSrc ? (
        <Suspense fallback={null}>
          <TileFaceTexture src={textureSrc} standing={isStanding} />
        </Suspense>
      ) : null}
      {tingHint ? <TingDot standing={isStanding} /> : null}
    </animated.group>
  );
}

export function TileKindPreview3D({
  kind,
  position,
  rotation = [0, 0, 0],
  scale = 1,
}: {
  kind: TileKind;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const [suit, rawRank] = kind.split("-");
  const rank = Number.isNaN(Number(rawRank)) ? rawRank : Number(rawRank);
  const tile: TileInstance = {
    id: `preview-${kind}`,
    kind,
    suit: suit as TileInstance["suit"],
    rank: rank as TileInstance["rank"],
    copy: 0,
  };

  return (
    <TileMesh
      tile={tile}
      faceUp
      liangDao
      scale={scale}
      position={position}
      rotation={rotation}
    />
  );
}
