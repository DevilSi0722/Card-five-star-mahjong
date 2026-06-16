"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { RoundedBox } from "@react-three/drei";
import { animated, useSpring } from "@react-spring/three";
import type { SpringValue } from "@react-spring/three";
import type { CollisionEnterPayload } from "@react-three/rapier";
import { playSound, preloadSound } from "@/lib/audio/soundEngine";

const DOT_COLOR = "#12151a";
const DIE_COLOR = "#f8f4e8";
const DIE_SIZE = 0.12;
const DIE_HALF = DIE_SIZE / 2;
const DOT_RADIUS = 0.008;
const DOT_OFFSET = 0.028;
const FACE_OFFSET = DIE_HALF + 0.002;
const TABLE_Y = 0.18;
const DICE_HOLD_DURATION_MS = 2250;
const DICE_FADE_DURATION_MS = 180;
const DICE_SOUND_DELAY_MS = 100;
const TABLE_COLLIDER_NAME = "dice-roll-table-collider";

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
      position: [randomBetween(-0.12, -0.05), randomBetween(1.55, 1.75), randomBetween(-0.08, 0.02)],
      rotation: [randomBetween(0, Math.PI * 2), randomBetween(0, Math.PI * 2), randomBetween(0, Math.PI * 2)],
      linvel: [randomBetween(0.35, 0.72), randomBetween(-0.45, -0.12), randomBetween(-0.26, 0.24)],
      angvel: [randomBetween(12, 20), randomBetween(-18, 18), randomBetween(-21, -12)],
    },
    {
      id: "b",
      position: [randomBetween(0.05, 0.13), randomBetween(1.62, 1.85), randomBetween(-0.02, 0.1)],
      rotation: [randomBetween(0, Math.PI * 2), randomBetween(0, Math.PI * 2), randomBetween(0, Math.PI * 2)],
      linvel: [randomBetween(-0.72, -0.35), randomBetween(-0.45, -0.12), randomBetween(-0.24, 0.26)],
      angvel: [randomBetween(-20, -12), randomBetween(-18, 18), randomBetween(12, 21)],
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
      <RoundedBox args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} radius={0.024} smoothness={4} castShadow receiveShadow>
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

function PhysicsDie({
  seed,
  opacity,
  onFirstTableHit,
}: {
  seed: DieSeed;
  opacity: SpringValue<number>;
  onFirstTableHit: (payload: CollisionEnterPayload) => void;
}) {
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
      mass={0.11}
      canSleep
      ccd
      additionalSolverIterations={4}
      onCollisionEnter={onFirstTableHit}
    >
      <CuboidCollider args={[DIE_HALF, DIE_HALF, DIE_HALF]} contactSkin={0.002} />
      <DieModel opacity={opacity} />
    </RigidBody>
  );
}

function DicePhysicsScene({
  seeds,
  opacity,
  onFirstTableHit,
}: {
  seeds: DieSeed[];
  opacity: SpringValue<number>;
  onFirstTableHit: (payload: CollisionEnterPayload) => void;
}) {
  return (
    <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60} maxCcdSubsteps={4}>
      <CuboidCollider
        position={[0, TABLE_Y - 0.025, 0]}
        args={[2.2, 0.025, 1.55]}
        friction={2.1}
        restitution={0.18}
        name={TABLE_COLLIDER_NAME}
      />
      {seeds.map((seed) => (
        <PhysicsDie key={seed.id} seed={seed} opacity={opacity} onFirstTableHit={onFirstTableHit} />
      ))}
    </Physics>
  );
}

export function DiceRoll3D({ active }: { active: boolean }) {
  const [seeds, setSeeds] = useState(() => createDieSeeds());
  const [visible, setVisible] = useState(active);
  const [spring, api] = useSpring(() => ({ opacity: 1 }));
  const playedLandingSoundRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      api.stop();
      return;
    }

    let cancelled = false;
    let fadeTimer: number | undefined;
    let soundTimer: number | undefined;
    playedLandingSoundRef.current = false;
    preloadSound("diceRoll");
    setSeeds(createDieSeeds());
    setVisible(true);
    api.stop();
    api.set({ opacity: 1 });

    fadeTimer = window.setTimeout(() => {
      api.start({
        opacity: 0,
        config: { duration: DICE_FADE_DURATION_MS },
        onRest: () => {
          if (!cancelled) setVisible(false);
        },
      });
    }, DICE_HOLD_DURATION_MS);

    soundTimer = window.setTimeout(() => {
      if (cancelled || playedLandingSoundRef.current) return;
      playedLandingSoundRef.current = true;
      playSound("diceRoll");
    }, DICE_SOUND_DELAY_MS);

    return () => {
      cancelled = true;
      if (fadeTimer) window.clearTimeout(fadeTimer);
      if (soundTimer) window.clearTimeout(soundTimer);
      api.stop();
    };
  }, [active, api]);

  const scene = useMemo(
    () => (
      <DicePhysicsScene
        seeds={seeds}
        opacity={spring.opacity}
        onFirstTableHit={(payload) => {
          if (payload.other.colliderObject?.name !== TABLE_COLLIDER_NAME) return;
          if (playedLandingSoundRef.current) return;
          playedLandingSoundRef.current = true;
          playSound("diceRoll");
        }}
      />
    ),
    [spring.opacity, seeds],
  );

  if (!active || !visible) return null;
  return <animated.group>{scene}</animated.group>;
}
