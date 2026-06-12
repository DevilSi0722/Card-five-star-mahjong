"use client";

import { animated, useSpring } from "@react-spring/three";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { TileMesh } from "@/components/three/TileMesh";
import type { ScoreResult, TileInstance } from "@/types/mahjong";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { TILE_KIND_LABEL } from "@/utils/mahjong/tiles";

function HorseCardScene({ tile, revealed }: { tile: TileInstance; revealed: boolean }) {
  const [faceUp, setFaceUp] = useState(false);
  const [spring, api] = useSpring(() => ({
    rotationY: Math.PI,
    config: { duration: 500 },
  }));

  useEffect(() => {
    if (!revealed) {
      setFaceUp(false);
      api.set({ rotationY: Math.PI });
      return undefined;
    }

    const turnTimer = window.setTimeout(() => {
      api.start({ rotationY: 0, config: { duration: 500 } });
    }, 1000);
    const faceTimer = window.setTimeout(() => {
      setFaceUp(true);
    }, 1250);

    return () => {
      window.clearTimeout(turnTimer);
      window.clearTimeout(faceTimer);
    };
  }, [api, revealed]);

  return (
    <>
      <ambientLight intensity={1.25} />
      <directionalLight position={[2.4, 2.8, 5.5]} intensity={2.15} castShadow />
      <directionalLight position={[-2.8, 1.8, 3]} intensity={0.95} />
      <animated.group rotation-y={spring.rotationY as unknown as number}>
        <TileMesh
          tile={tile}
          faceUp={faceUp}
          standing
          position={[0, 0.1, 0]}
          rotation={[0, 0, 0]}
          scale={2.35}
          animationConfig={{ tension: 220, friction: 18 }}
        />
      </animated.group>
    </>
  );
}

export function BuyHorseRevealOverlay({ result }: { result: NonNullable<ScoreResult["buyHorse"]> }) {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const [revealed, setRevealed] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDetailsVisible(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  const summary = useMemo(
    () => ({
      label: TILE_KIND_LABEL[result.tile.kind],
      value: result.value,
      bonus: result.bonus,
    }),
    [result.bonus, result.tile.kind, result.value],
  );

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className={`flex flex-col items-center ${isMobileLandscape ? "gap-1.5" : "gap-4"}`}>
        <div className="text-center">
          <div className={`${isMobileLandscape ? "text-[10px]" : "text-sm"} font-semibold tracking-[0.24em] text-sky-200`}>
            买马
          </div>
          <div className={`${isMobileLandscape ? "mt-0 text-lg" : "mt-1 text-2xl"} font-bold text-white`}>开马牌</div>
        </div>

        <div className={`relative ${isMobileLandscape ? "h-[150px] w-[150px]" : "h-[240px] w-[240px] sm:h-[300px] sm:w-[300px]"}`}>
          <Canvas
            shadows
            className="absolute inset-0"
            camera={{ position: [0, 0.35, 5.25], fov: isMobileLandscape ? 34 : 28 }}
            gl={{ antialias: true, alpha: true }}
          >
            <HorseCardScene tile={result.tile} revealed={revealed} />
          </Canvas>
          <div className="pointer-events-none absolute inset-x-6 bottom-3 h-8 rounded-full bg-sky-400/20 blur-xl" />
        </div>

        <div
          className={`text-center transition-all duration-300 ${
            detailsVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <div className={`${isMobileLandscape ? "text-base" : "text-xl"} font-bold text-sky-100`}>{summary.label}</div>
          <div className={`${isMobileLandscape ? "mt-0 text-xs" : "mt-1 text-sm"} text-sky-200`}>点数 {summary.value}</div>
          <div className={`${isMobileLandscape ? "mt-0.5 text-lg" : "mt-2 text-2xl"} font-bold text-emerald-200`}>
            额外 +{summary.bonus}
          </div>
        </div>
      </div>
    </div>
  );
}
