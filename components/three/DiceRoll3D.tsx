"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { RoundedBox } from "@react-three/drei";
import { animated, useSpring } from "@react-spring/three";
import type { SpringValue } from "@react-spring/three";

const DOT_COLOR = "#12151a";
const DIE_COLOR = "#f8f4e8";
const DIE_SIZE = 0.16;
const DIE_HALF = DIE_SIZE / 2;
const DOT_RADIUS = 0.0105;
const DOT_OFFSET = 0.038;
const FACE_OFFSET = DIE_HALF + 0.002;
const TABLE_Y = 0.18;

type DotFace = "front" | "back" | "right" | "left" | "top" | "bottom";

type DieSeed = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  linvel: [number, number, number];
  angvel: [number, number, number];
};

const FACE_ROTATION: Record<DotFace, [number, number, number]> = {
  front: [0, 0, 0],
  back: [0, Math.PI, 0],
  right: [0, Math.PI / 2, 0],
  left: [0, -Math.PI / 2, 0],
  top: [-Math.PI / 2, 0, 0],
  bottom: [Math.PI / 2, 0, 0],
};

const FACE_POSITION: Record<DotFace, [number, number, number]> = {
  front: [0, 0, FACE_OFFSET],
  back: [0, 0, -FACE_OFFSET],
  right: [FACE_OFFSET, 0, 0],
  left: [-FACE_OFFSET, 0, 0],
  top: [0, FACE_OFFSET, 0],
  bottom: [0, -FACE_OFFSET, 0],
};

const DOTS: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [
    [-DOT_OFFSET, DOT_OFFSET],
    [DOT_OFFSET, -DOT_OFFSET],
  ],
  3: [
    [-DOT_OFFSET, DOT_OFFSET],
    [0, 0],
    [DOT_OFFSET, -DOT_OFFSET],
  ],
  4: [
    [-DOT_OFFSET, DOT_OFFSET],
    [DOT_OFFSET, DOT_OFFSET],
    [-DOT_OFFSET, -DOT_OFFSET],
    [DOT_OFFSET, -DOT_OFFSET],
  ],
  5: [
    [-DOT_OFFSET, DOT_OFFSET],
    [DOT_OFFSET, DOT_OFFSET],
    [0, 0],
    [-DOT_OFFSET, -DOT_OFFSET],
    [DOT_OFFSET, -DOT_OFFSET],
  ],
  6: [
    [-DOT_OFFSET, DOT_OFFSET],
    [DOT_OFFSET, DOT_OFFSET],
    [-DOT_OFFSET, 0],
    [DOT_OFFSET, 0],
    [-DOT_OFFSET, -DOT_OFFSET],
    [DOT_OFFSET, -DOT_OFFSET],
  ],
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createDieSeeds(): DieSeed[] {
  return [
    {
      id: "a",
      position: [randomBetween(-0.12, -0.05), randomBetween(2.1, 2.35), randomBetween(-0.08, 0.02)],
      rotation: [randomBetween(0, Math.PI * 2), randomBetween(0, Math.PI * 2), randomBetween(0, Math.PI * 2)],
      linvel: [randomBetween(0.45, 0.9), randomBetween(-0.55, -0.15), randomBetween(-0.32, 0.28)],
      angvel: [randomBetween(11, 18), randomBetween(-16, 16), randomBetween(-19, -11)],
    },
    {
      id: "b",
      position: [randomBetween(0.05, 0.13), randomBetween(2.18, 2.45), randomBetween(-0.02, 0.1)],
      rotation: [randomBetween(0, Math.PI * 2), randomBetween(0, Math.PI * 2), randomBetween(0, Math.PI * 2)],
      linvel: [randomBetween(-0.9, -0.45), randomBetween(-0.55, -0.15), randomBetween(-0.28, 0.32)],
      angvel: [randomBetween(-18, -11), randomBetween(-16, 16), randomBetween(11, 19)],
    },
  ];
}

function FaceDots({ face, value }: { face: DotFace; value: number }) {
  return (
    <group position={FACE_POSITION[face]} rotation={FACE_ROTATION[face]}>
      {DOTS[value].map(([x, y], index) => (
        <mesh key={`${face}-${index}`} position={[x, y, 0]}>
          <circleGeometry args={[DOT_RADIUS, 16]} />
          <meshBasicMaterial color={DOT_COLOR} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function DieModel({ opacity }: { opacity: SpringValue<number> }) {
  return (
    <group>
      <RoundedBox args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} radius={0.032} smoothness={4} castShadow receiveShadow>
        <animated.meshStandardMaterial
          color={DIE_COLOR}
          opacity={opacity}
          roughness={0.42}
          metalness={0.02}
          transparent
          toneMapped={false}
        />
      </RoundedBox>
      <animated.group scale={opacity as unknown as number}>
        <FaceDots face="front" value={1} />
        <FaceDots face="back" value={6} />
        <FaceDots face="right" value={3} />
        <FaceDots face="left" value={4} />
        <FaceDots face="top" value={5} />
        <FaceDots face="bottom" value={2} />
      </animated.group>
    </group>
  );
}

function PhysicsDie({ seed, opacity }: { seed: DieSeed; opacity: SpringValue<number> }) {
  const bodyRef = useRef<RapierRigidBody>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.wakeUp();
    body.setLinvel({ x: seed.linvel[0], y: seed.linvel[1], z: seed.linvel[2] }, true);
    body.setAngvel({ x: seed.angvel[0], y: seed.angvel[1], z: seed.angvel[2] }, true);
  }, [seed]);

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      position={seed.position}
      rotation={seed.rotation}
      linearDamping={0.72}
      angularDamping={0.52}
      friction={1.8}
      restitution={0.32}
      mass={0.18}
      canSleep
      ccd
      additionalSolverIterations={4}
    >
      <CuboidCollider args={[DIE_HALF, DIE_HALF, DIE_HALF]} contactSkin={0.003} />
      <DieModel opacity={opacity} />
    </RigidBody>
  );
}

function DicePhysicsScene({ seeds, opacity }: { seeds: DieSeed[]; opacity: SpringValue<number> }) {
  return (
    <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60} maxCcdSubsteps={4}>
      <CuboidCollider
        position={[0, TABLE_Y - 0.025, 0]}
        args={[2.2, 0.025, 1.55]}
        friction={2.1}
        restitution={0.18}
      />
      {seeds.map((seed) => (
        <PhysicsDie key={seed.id} seed={seed} opacity={opacity} />
      ))}
    </Physics>
  );
}

export function DiceRoll3D({ active }: { active: boolean }) {
  const [seeds, setSeeds] = useState(() => createDieSeeds());
  const [spring, api] = useSpring(() => ({ opacity: 1 }));

  useEffect(() => {
    if (!active) return;
    setSeeds(createDieSeeds());
    api.start({
      from: { opacity: 1 },
      to: async (next) => {
        await next({ opacity: 1, config: { duration: 1180 } });
        await next({ opacity: 0, config: { duration: 260 } });
      },
    });
  }, [active, api]);

  const scene = useMemo(() => <DicePhysicsScene seeds={seeds} opacity={spring.opacity} />, [spring.opacity, seeds]);

  if (!active) return null;
  return <animated.group>{scene}</animated.group>;
}
