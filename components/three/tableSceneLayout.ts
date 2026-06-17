import type { Player } from "@/types/mahjong";

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface DiscardLayout {
  origin: Vec3;
  col: Vec2;
  row: Vec2;
  rotationY: number;
}

export interface HandTransform {
  center: Vec3;
  step: Vec3;
  rotation: Vec3;
}

export interface TableSceneLayout {
  position: Vec3;
  scale: Vec3;
  physicsTableOffsetZ: number;
  physicsSpawnOffsetZ: number;
}

const MOBILE_TABLE_GROUP_Z = -0.86;
const DESKTOP_TABLE_GROUP_Z = -0.95;
const MOBILE_TABLE_SCALE = 1.25;
const DESKTOP_TABLE_SCALE = 1.16;

const DESKTOP_REVEALED_BOTTOM_HAND_OFFSET_Z = 0.28;
const DESKTOP_PHYSICS_SPAWN_RESTORE_Z = -0.77;
const MOBILE_PHYSICS_SPAWN_RESTORE_Z = -0.38;
const DESKTOP_SIDE_STANDING_HAND_OFFSET_Z = 0.14;

export function tableGroupPosition(mobileLandscape: boolean): Vec3 {
  return [0, 0, mobileLandscape ? MOBILE_TABLE_GROUP_Z : DESKTOP_TABLE_GROUP_Z];
}

export function tableGroupScale(mobileLandscape: boolean): Vec3 {
  const scale = mobileLandscape ? MOBILE_TABLE_SCALE : DESKTOP_TABLE_SCALE;
  return [scale, scale, scale];
}

export function physicsTableOffsetZ(_mobileLandscape: boolean): number {
  return 0;
}

export function physicsSpawnOffsetZ(mobileLandscape: boolean): number {
  return mobileLandscape ? MOBILE_PHYSICS_SPAWN_RESTORE_Z : DESKTOP_PHYSICS_SPAWN_RESTORE_Z;
}

export function getTableSceneLayout(mobileLandscape: boolean): TableSceneLayout {
  return {
    position: tableGroupPosition(mobileLandscape),
    scale: tableGroupScale(mobileLandscape),
    physicsTableOffsetZ: physicsTableOffsetZ(mobileLandscape),
    physicsSpawnOffsetZ: physicsSpawnOffsetZ(mobileLandscape),
  };
}

export function playerHandTransform(seat: Player["seat"], compact: boolean): HandTransform {
  const bottom = compact
    ? { center: [0, 0.24, 2.1] as Vec3, step: [0.32, 0, 0] as Vec3 }
    : { center: [0, 0.24, 2.05] as Vec3, step: [0.36, 0, 0] as Vec3 };
  const left = compact
    ? { center: [-2.56, 0.24, 0] as Vec3, step: [0, 0, 0.29] as Vec3 }
    : { center: [-2.75, 0.24, 0] as Vec3, step: [0, 0, 0.34] as Vec3 };
  const right = compact
    ? { center: [2.56, 0.24, 0] as Vec3, step: [0, 0, -0.29] as Vec3 }
    : { center: [2.75, 0.24, 0] as Vec3, step: [0, 0, -0.34] as Vec3 };

  if (seat === "bottom") return { ...bottom, rotation: [0, 0, 0] };
  if (seat === "left") return { ...left, rotation: [0, Math.PI / 2, 0] };
  return { ...right, rotation: [0, -Math.PI / 2, 0] };
}

export function revealedHandOffset(seat: Player["seat"], compact: boolean): Vec3 {
  if (!compact && seat === "bottom") return [0, 0, DESKTOP_REVEALED_BOTTOM_HAND_OFFSET_Z];
  return [0, 0, 0];
}

export function standingHandOffset(seat: Player["seat"], compact: boolean): Vec3 {
  if (!compact && (seat === "left" || seat === "right")) return [0, 0, DESKTOP_SIDE_STANDING_HAND_OFFSET_Z];
  return [0, 0, 0];
}

export function lyingRotationForSeat(seat: Player["seat"]): Vec3 {
  if (seat === "left") return [0, -Math.PI / 2, 0];
  if (seat === "right") return [0, Math.PI / 2, 0];
  return [0, 0, 0];
}

export function discardLayout(seat: Player["seat"]): DiscardLayout {
  if (seat === "bottom") {
    return { origin: [-0.82, 0.25, 0.68], col: [0.25, 0], row: [0, 0.32], rotationY: 0 };
  }
  if (seat === "left") {
    return { origin: [-0.98, 0.25, -1.08], col: [0, 0.25], row: [-0.32, 0], rotationY: -Math.PI / 2 };
  }
  return { origin: [0.98, 0.25, 0.82], col: [0, -0.25], row: [0.32, 0], rotationY: Math.PI / 2 };
}

export function handSourcePosition(seat: Player["seat"]): Vec3 {
  if (seat === "bottom") return [0, 0.42, 2.22];
  if (seat === "left") return [-2.75, 0.48, 0];
  return [2.75, 0.48, 0];
}

export function discardSourcePosition(seat: Player["seat"]): Vec3 {
  if (seat === "bottom") return [0, 0.5, 0.92];
  if (seat === "left") return [-1.18, 0.5, -0.2];
  return [1.18, 0.5, 0.2];
}

export function handSourceRotation(seat: Player["seat"]): Vec3 {
  if (seat === "left") return [0, Math.PI / 2, 0];
  if (seat === "right") return [0, -Math.PI / 2, 0];
  return [0, 0, 0];
}

export function wallSourcePosition(seat: Player["seat"]): Vec3 {
  if (seat === "left") return [-1.7, 0.55, -1.15];
  if (seat === "right") return [1.7, 0.55, 1.15];
  return [0, 0.55, 1.15];
}

export function meldBaseForSeat(seat: Player["seat"], compact: boolean): Vec3 {
  const desktopScreenDownOffset = compact ? 0 : 0.28;
  if (seat === "bottom") return [-2.15, 0.18, 1.52 + desktopScreenDownOffset];
  if (seat === "left") return [-3.32, 0.18, -1.95 + desktopScreenDownOffset];
  return [3.32, 0.18, -1.95 + desktopScreenDownOffset];
}
