"use client";

import { useEffect, useMemo, useRef } from "react";
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import type { Player } from "@/types/mahjong";
import { TileMesh, TILE_WIDTH, TILE_LENGTH, TILE_THICKNESS } from "./TileMesh";

// 每家最多保留多少张弃牌参与物理模拟；数量越大，碰撞越真实，但移动端压力也越大。
const DISCARD_LIMIT_PER_PLAYER = 18;
// 牌模型的渲染/碰撞整体缩放。调大后牌看起来更大，碰撞盒也更大，更容易互相顶开。
const TILE_SCALE = 0.64;
// 单张麻将牌碰撞盒的半尺寸。直接从 TileMesh 的可见尺寸派生，确保碰撞盒厚度永远和渲染厚度一致；
// 想改牌的薄厚只需改 TileMesh.tsx 里的 TILE_THICKNESS，这里会自动跟随，不会出现碰撞盒和模型对不上的穿模问题。
const TILE_HALF_WIDTH = TILE_WIDTH * TILE_SCALE * 0.5;
const TILE_HALF_LENGTH = TILE_LENGTH * TILE_SCALE * 0.5;
const TILE_HALF_HEIGHT = TILE_THICKNESS * TILE_SCALE * 0.5;
// 桌面和牌刚体的高度。BODY_Y 是牌在桌面水平滑动时的固定 Y 坐标。
const TABLE_Y = 0.19;
const BODY_Y = TABLE_Y + TILE_HALF_HEIGHT + 0.025;
// 桌面可活动边界。调小会让牌更早撞墙停在中心附近；调大会允许牌滑得更远。
const TABLE_HALF_WIDTH = 3.12;
const TABLE_HALF_LENGTH = 2.32;
// 四周隐形挡墙厚度。主要防止牌滑出桌面，通常不需要频繁调整。
const WALL_THICKNESS = 0.12;
// 出牌出生点离桌边的安全距离。必须大于牌的半长/半宽，避免刚体一生成就卡进挡墙。
const SPAWN_EDGE_PADDING = Math.max(TILE_HALF_WIDTH, TILE_HALF_LENGTH) + 0.38;
// 桌面摩擦力：现实麻将桌的主要摩擦来源。越大，牌贴桌面滑动时越快减速。
const TABLE_FRICTION = 50.95;
// 连续碰撞检测子步。手机低帧率、牌速高、牌堆密时，调大可减少穿模，但会增加性能开销。
const MAX_CCD_SUBSTEPS = 4;
// 碰撞皮肤厚度。相当于给碰撞盒外侧加一层很薄的缓冲，能减少牌堆中互相穿透。
const TILE_CONTACT_SKIN = 0.012;
// 软 CCD 预测距离。用于提前发现薄物体即将发生的碰撞，降低高速滑动穿模概率。
const TILE_SOFT_CCD_PREDICTION = 0.06;
// 额外求解迭代。牌堆越密越需要更高迭代来把重叠解开；过高会影响手机性能。
const TILE_ADDITIONAL_SOLVER_ITERATIONS = 3;

type DiscardTile = {
  tile: Player["discards"][number];
  playerId: Player["id"];
  seat: Player["seat"];
  sequence: number;
};

const renderedDiscardTileIds = new Set<string>();
let renderedDiscardTileIdsInitialized = false;

function handSourcePosition(
  seat: Player["seat"],
  sequence: number,
  mobileLandscape: boolean,
  tableOffsetZ: number,
  spawnOffsetZ: number,
): [number, number, number] {
  // 出牌初始位置。只调 X/Z 会改变牌从哪个桌边推出；Y 保持 BODY_Y，避免牌从空中掉落。
  // 这里的坐标必须在四周挡墙内侧，否则手机低帧率或多人游戏重渲染时容易把牌解算到桌边卡住。
  // 出生点也做轻微分散，避免某张牌异常停在出牌口时，后续牌全部叠在同一位置被堵住。
  const sourceDrift = ((sequence % 5) - 2) * 0.18;
  const spawnZ = tableOffsetZ + spawnOffsetZ;
  if (seat === "bottom") {
    const mobileInset = mobileLandscape ? 0.38 : 0;
    return [sourceDrift, BODY_Y, TABLE_HALF_LENGTH - SPAWN_EDGE_PADDING - mobileInset + spawnZ];
  }
  if (seat === "left") return [-TABLE_HALF_WIDTH + SPAWN_EDGE_PADDING, BODY_Y, sourceDrift + spawnZ];
  return [TABLE_HALF_WIDTH - SPAWN_EDGE_PADDING, BODY_Y, -sourceDrift + spawnZ];
}

function launchVelocity(seat: Player["seat"], sequence: number, mobileLandscape: boolean): [number, number, number] {
  // 出牌初速度，是最直接影响“滑多远”的参数。
  // x/z 的主方向数值越大，牌越能滑向桌心；sideDrift 越大，同一玩家连续弃牌越分散。
  const sideDrift = ((sequence % 5) - 2) * 0.58;
  if (seat === "bottom") {
    const mobileBoost = mobileLandscape ? 1.35 : 0;
    return [sideDrift, 0, -16 - mobileBoost - (sequence % 3) * 0.38];
  }
  if (seat === "left") return [16 + (sequence % 3) * 0.38, 0, sideDrift];
  return [-16.0 - (sequence % 3) * 0.38, 0, -sideDrift];
}

function startRotation(seat: Player["seat"], sequence: number): [number, number, number] {
  // 牌刚推出时的朝向扰动。scatter 越大，牌停下后的角度越乱、更自然。
  const scatter = ((sequence % 9) - 4) * 0.08;
  if (seat === "left") return [0, Math.PI / 2 + scatter, 0];
  if (seat === "right") return [0, -Math.PI / 2 + scatter, 0];
  return [0, scatter, 0];
}

function PhysicsDiscardTile({
  item,
  fresh,
  mobileLandscape,
  tableOffsetZ,
  spawnOffsetZ,
}: {
  item: DiscardTile;
  fresh: boolean;
  mobileLandscape: boolean;
  tableOffsetZ: number;
  spawnOffsetZ: number;
}) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const initialPositionRef = useRef(
    handSourcePosition(item.seat, item.sequence, mobileLandscape, tableOffsetZ, spawnOffsetZ),
  );
  const start = initialPositionRef.current;
  const rotation = startRotation(item.seat, item.sequence);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (!fresh) return;
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setTranslation({ x: start[0], y: start[1], z: start[2] }, true);
    body.setRotation({ x: 0, y: Math.sin(rotation[1] / 2), z: 0, w: Math.cos(rotation[1] / 2) }, true);
    const launchTimer = window.setTimeout(() => {
      const liveBody = bodyRef.current;
      if (!liveBody) return;
      liveBody.wakeUp();
      const velocity = launchVelocity(item.seat, item.sequence, mobileLandscape);
      liveBody.setLinvel({ x: velocity[0], y: velocity[1], z: velocity[2] }, true);
      liveBody.setAngvel({ x: 0, y: 2.4 + (item.sequence % 4) * 0.45, z: 0 }, true);
    }, 40);
    return () => window.clearTimeout(launchTimer);
  }, [fresh, item.seat, item.sequence, mobileLandscape, rotation, start]);

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      position={start}
      rotation={rotation}
      // 只允许牌在桌面 X/Z 平面滑动，锁住 Y，避免牌从上方掉落或爬到其他牌上。
      enabledTranslations={[true, false, true]}
      // 只允许绕 Y 轴旋转，禁止翻滚/翘起，减少堆叠。
      enabledRotations={[false, true, false]}
      // 线性阻尼：越大越快停下，滑动距离越短；越小越滑。
      linearDamping={7.85}
      // 角阻尼：越大越快停止旋转；越小越容易持续转圈。
      angularDamping={3.1}
      // 摩擦：越大越难滑动、碰撞后更快停住；越小越像冰面。
      friction={0.99}
      // 弹性：越大碰撞越弹；麻将牌建议保持低值，避免弹飞。
      restitution={0.001}
      canSleep
      // CCD/额外迭代主要解决手机端牌多、高速薄碰撞体容易一帧穿过牌堆的问题。
      ccd
      softCcdPrediction={TILE_SOFT_CCD_PREDICTION}
      additionalSolverIterations={TILE_ADDITIONAL_SOLVER_ITERATIONS}
      // 质量：越大越不容易被其他牌撞动；越小更容易被推开。
      mass={8.2}
    >
      <CuboidCollider
        args={[TILE_HALF_WIDTH, TILE_HALF_HEIGHT, TILE_HALF_LENGTH]}
        contactSkin={TILE_CONTACT_SKIN}
      />
      <TileMesh tile={item.tile} faceUp scale={TILE_SCALE} position={[0, 0, 0]} rotation={[0, 0, 0]} />
    </RigidBody>
  );
}

function TableColliders({ tableOffsetZ }: { tableOffsetZ: number }) {
  return (
    <>
      {/* 桌面碰撞平面。Y 坐标和厚度会影响牌是否贴桌面滑动。 */}
      <CuboidCollider
        position={[0, TABLE_Y - 0.035, tableOffsetZ]}
        args={[TABLE_HALF_WIDTH, 0.035, TABLE_HALF_LENGTH]}
        friction={TABLE_FRICTION}
      />
      {/* 四周隐形挡墙。主要影响牌是否会滑出桌面，以及撞墙后是否回弹到中心。 */}
      <CuboidCollider
        position={[0, BODY_Y, -TABLE_HALF_LENGTH - WALL_THICKNESS + tableOffsetZ]}
        args={[TABLE_HALF_WIDTH, 0.18, WALL_THICKNESS]}
      />
      <CuboidCollider
        position={[0, BODY_Y, TABLE_HALF_LENGTH + WALL_THICKNESS + tableOffsetZ]}
        args={[TABLE_HALF_WIDTH, 0.18, WALL_THICKNESS]}
      />
      <CuboidCollider
        position={[-TABLE_HALF_WIDTH - WALL_THICKNESS, BODY_Y, tableOffsetZ]}
        args={[WALL_THICKNESS, 0.18, TABLE_HALF_LENGTH]}
      />
      <CuboidCollider
        position={[TABLE_HALF_WIDTH + WALL_THICKNESS, BODY_Y, tableOffsetZ]}
        args={[WALL_THICKNESS, 0.18, TABLE_HALF_LENGTH]}
      />
    </>
  );
}

export function PhysicsDiscardArea3D({
  players,
  mobileLandscape = false,
  tableOffsetZ = 0,
  spawnOffsetZ = 0,
}: {
  players: Player[];
  mobileLandscape?: boolean;
  tableOffsetZ?: number;
  spawnOffsetZ?: number;
}) {
  const discards = useMemo(
    () =>
      players.flatMap((player) =>
        player.discards.slice(-DISCARD_LIMIT_PER_PLAYER).map((tile, index) => ({
          tile,
          playerId: player.id,
          seat: player.seat,
          sequence: index,
        })),
      ),
    [players],
  );
  const currentTileIds = discards.map((item) => item.tile.id);
  const freshTileIds = renderedDiscardTileIdsInitialized
    ? new Set(currentTileIds.filter((tileId) => !renderedDiscardTileIds.has(tileId)))
    : new Set<string>();

  useEffect(() => {
    const current = new Set(currentTileIds);
    for (const tileId of Array.from(renderedDiscardTileIds)) {
      if (!current.has(tileId)) renderedDiscardTileIds.delete(tileId);
    }
    for (const tileId of currentTileIds) renderedDiscardTileIds.add(tileId);
    renderedDiscardTileIdsInitialized = true;
  }, [currentTileIds]);

  return (
    // gravity 现在对牌本身影响很小，因为牌锁住了 Y 平移；它主要服务于桌面/碰撞世界的一致性。
    <Physics
      gravity={[0, -9.81, 0]}
      timeStep={1 / 60}
      maxCcdSubsteps={MAX_CCD_SUBSTEPS}
      paused={discards.length === 0}
    >
      <TableColliders tableOffsetZ={tableOffsetZ} />
      {discards.map((item) => (
        <PhysicsDiscardTile
          key={`${item.playerId}-${item.tile.id}`}
          item={item}
          fresh={freshTileIds.has(item.tile.id)}
          mobileLandscape={mobileLandscape}
          tableOffsetZ={tableOffsetZ}
          spawnOffsetZ={spawnOffsetZ}
        />
      ))}
    </Physics>
  );
}
