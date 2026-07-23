"use client";

import { Suspense, useMemo, useState } from "react";
import { useTexture } from "@react-three/drei";
import { animated, useSpring } from "@react-spring/three";
import { ExtrudeGeometry, Shape, SRGBColorSpace } from "three";
import { useUiStore } from "@/store/uiStore";
import type { TileInstance, TileKind } from "@/types/mahjong";
import { getTileBackOption, TILE_BACK_OPTIONS } from "@/utils/tileBacks";
import { getTileTextureSrc } from "@/utils/mahjong/tileTextures";

TILE_BACK_OPTIONS.forEach((option) => useTexture.preload(option.src));

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
  flyFrom?: [number, number, number];
  flyFromRotation?: [number, number, number];
  animationConfig?: { tension: number; friction: number };
  onClick?: () => void;
  onDoubleClick?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

const FACE_BACKGROUND = "#f5f1df";
// 牌的基础尺寸（导出供物理碰撞盒派生，确保可见厚度与碰撞盒永远一致）。
// 调厚度只改这里，PhysicsDiscardArea3D 的碰撞盒半高会自动跟随，不会穿模。
export const TILE_WIDTH = 0.34;
export const TILE_LENGTH = 0.5;
export const TILE_THICKNESS = 0.15;
const TILE_CORNER_RADIUS = 0.035;
const TILE_EDGE_BEVEL = 0.018;
const TILE_RENDERED_HALF_THICKNESS = TILE_THICKNESS / 2 + TILE_EDGE_BEVEL;
const TILE_SURFACE_OFFSET = 0.0005;
const STANDING_FACE_SIZE: [number, number] = [0.255, 0.355];
const LYING_FACE_SIZE: [number, number] = [0.275, 0.383];
const BODY_MATERIAL_INDEX = 0;
const BACK_MATERIAL_INDEX = 1;

function createRoundedRectangleShape(width: number, height: number, radius: number) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const safeRadius = Math.min(radius, halfWidth, halfHeight);
  const shape = new Shape();

  shape.moveTo(-halfWidth + safeRadius, -halfHeight);
  shape.lineTo(halfWidth - safeRadius, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + safeRadius);
  shape.lineTo(halfWidth, halfHeight - safeRadius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - safeRadius, halfHeight);
  shape.lineTo(-halfWidth + safeRadius, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - safeRadius);
  shape.lineTo(-halfWidth, -halfHeight + safeRadius);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + safeRadius, -halfHeight);

  return shape;
}

function TileBody({
  standing,
  selected,
  faceUp,
}: {
  standing: boolean;
  selected: boolean;
  faceUp: boolean;
}) {
  const tileBackId = useUiStore((state) => state.tileBackId);
  const tileBack = getTileBackOption(tileBackId);
  const sourceBackTexture = useTexture(tileBack.src);
  const backTexture = useMemo(() => {
    sourceBackTexture.colorSpace = SRGBColorSpace;
    sourceBackTexture.anisotropy = 16;
    sourceBackTexture.needsUpdate = true;
    return sourceBackTexture;
  }, [sourceBackTexture]);
  const bodyGeometry = useMemo(() => {
    const shape = createRoundedRectangleShape(TILE_WIDTH, TILE_LENGTH, TILE_CORNER_RADIUS);
    const roundedGeometry = new ExtrudeGeometry(shape, {
      depth: TILE_THICKNESS,
      bevelEnabled: true,
      bevelSegments: 5,
      bevelSize: TILE_EDGE_BEVEL,
      bevelThickness: TILE_EDGE_BEVEL,
      curveSegments: 10,
    });

    const capGroup = roundedGeometry.groups[0];
    const sideGroup = roundedGeometry.groups[1];
    const capHalfCount = capGroup.count / 2;
    roundedGeometry.clearGroups();
    roundedGeometry.addGroup(capGroup.start, capHalfCount, BODY_MATERIAL_INDEX);
    roundedGeometry.addGroup(capGroup.start + capHalfCount, capGroup.count - capHalfCount, faceUp ? BODY_MATERIAL_INDEX : BACK_MATERIAL_INDEX);
    roundedGeometry.addGroup(sideGroup.start, sideGroup.count, BODY_MATERIAL_INDEX);

    roundedGeometry.center();
    if (!standing) {
      roundedGeometry.rotateX(-Math.PI / 2);
    }
    roundedGeometry.computeVertexNormals();

    return roundedGeometry;
  }, [faceUp, standing]);

  return (
    <group>
      <mesh castShadow receiveShadow geometry={bodyGeometry}>
        <meshStandardMaterial
          attach="material-0"
          color={FACE_BACKGROUND}
          emissive={selected ? "#facc15" : "#000000"}
          emissiveIntensity={selected ? 0.45 : 0}
          roughness={0.55}
        />
        <meshStandardMaterial attach="material-1" color={tileBack.edgeColor} roughness={0.48} />
      </mesh>
      {!faceUp ? (
        standing ? (
          <mesh position={[0, 0, TILE_RENDERED_HALF_THICKNESS + TILE_SURFACE_OFFSET]}>
            <planeGeometry args={STANDING_FACE_SIZE} />
            <meshBasicMaterial map={backTexture} toneMapped={false} />
          </mesh>
        ) : (
          <mesh position={[0, TILE_RENDERED_HALF_THICKNESS + TILE_SURFACE_OFFSET, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={LYING_FACE_SIZE} />
            <meshBasicMaterial map={backTexture} toneMapped={false} />
          </mesh>
        )
      ) : null}
    </group>
  );
}

function TileFaceTexture({ src, standing = false }: { src: string; standing?: boolean }) {
  const sourceTexture = useTexture(src);
  const texture = useMemo(() => {
    sourceTexture.colorSpace = SRGBColorSpace;
    sourceTexture.anisotropy = 16;
    sourceTexture.needsUpdate = true;
    return sourceTexture;
  }, [sourceTexture]);

  return standing ? (
    <mesh position={[0, 0, TILE_RENDERED_HALF_THICKNESS + TILE_SURFACE_OFFSET]} rotation={[0, 0, 0]}>
      <planeGeometry args={STANDING_FACE_SIZE} />
      <meshBasicMaterial alphaTest={0.02} map={texture} toneMapped={false} transparent />
    </mesh>
  ) : (
    <mesh position={[0, TILE_RENDERED_HALF_THICKNESS + TILE_SURFACE_OFFSET, 0.01]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={LYING_FACE_SIZE} />
      <meshBasicMaterial alphaTest={0.02} map={texture} toneMapped={false} transparent />
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
  flyFrom,
  flyFromRotation,
  animationConfig,
  onClick,
  onDoubleClick,
  onHoverChange,
}: TileMeshProps) {
  const isStanding = standing && !liangDao;
  const [hovered, setHovered] = useState(false);
  const targetPosition = [
    position[0],
    position[1] + (isStanding ? 0.25 : 0) + (hovered ? 0.16 : 0),
    position[2],
  ] as [number, number, number];
  const startPosition = flyFrom
    ? ([flyFrom[0], flyFrom[1] + 0.56, flyFrom[2]] as [number, number, number])
    : undefined;
  // 仅悬浮才抬升（双击打出）；单击仅作选中（用于亮倒选张），不再「拿起」抬升
  const spring = useSpring({
    from: startPosition
      ? {
          position: startPosition,
          rotation: flyFromRotation ?? rotation,
        }
      : undefined,
    position: targetPosition,
    rotation,
    config: animationConfig ?? (flyFrom ? { tension: 190, friction: 22 } : { tension: 260, friction: 24 }),
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
      <TileBody standing={isStanding} selected={selected} faceUp={faceUp} />
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
