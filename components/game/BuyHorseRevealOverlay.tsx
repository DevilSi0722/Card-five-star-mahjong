"use client";

import { animated, useSpring } from "@react-spring/three";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { TileMesh } from "@/components/three/TileMesh";
import type { ScoreResult, TileInstance } from "@/types/mahjong";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { TILE_KIND_LABEL } from "@/utils/mahjong/tiles";

interface HorseCardSceneProps {
  tile: TileInstance;
  revealed: boolean;
  revealDelayMs?: number;
}

function HorseCardScene({ tile, revealed, revealDelayMs = 1000 }: HorseCardSceneProps) {
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
    }, revealDelayMs);
    const faceTimer = window.setTimeout(() => {
      setFaceUp(true);
    }, revealDelayMs + 250);

    return () => {
      window.clearTimeout(turnTimer);
      window.clearTimeout(faceTimer);
    };
  }, [api, revealDelayMs, revealed]);

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
  const items = useMemo(
    () => (
      result.items && result.items.length > 0
        ? result.items
        : [{ tile: result.tile, value: result.value, bonus: result.bonus }]
    ),
    [result.bonus, result.items, result.tile, result.value],
  );
  const isBuyOneGetOne = result.isBuyOneGetOne || items.length > 1;

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDetailsVisible(true), isBuyOneGetOne ? 3300 : 1500);
    return () => window.clearTimeout(timer);
  }, [isBuyOneGetOne]);

  const summary = useMemo(
    () => ({
      label: items.map((item) => TILE_KIND_LABEL[item.tile.kind]).join(" + "),
      value: result.totalValue ?? result.value,
      bonus: result.bonus,
    }),
    [items, result.bonus, result.totalValue, result.value],
  );

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-2 backdrop-blur-sm sm:p-4">
      <div className={`flex flex-col items-center ${isMobileLandscape ? "gap-1.5" : "gap-4"}`}>
        <div className="text-center">
          <div className={`${isMobileLandscape ? "text-[10px]" : "text-sm"} font-semibold tracking-[0.32em] text-gold-soft`}>
            买马
          </div>
          <div className={`brand-title ${isMobileLandscape ? "mt-0 text-2xl" : "mt-1 text-4xl"} font-bold`}>开马牌</div>
        </div>

        <div
          className={`relative grid items-center ${
            isBuyOneGetOne
              ? isMobileLandscape
                ? "h-[150px] w-[310px] grid-cols-2 gap-2"
                : "h-[240px] w-[500px] grid-cols-2 gap-4 sm:h-[300px] sm:w-[620px]"
              : isMobileLandscape
                ? "h-[150px] w-[150px]"
                : "h-[240px] w-[240px] sm:h-[300px] sm:w-[300px]"
          }`}
        >
          {items.map((item, index) => (
            <div key={item.tile.id} className="relative h-full min-w-0">
              <Canvas
                shadows
                className="absolute inset-0"
                camera={{ position: [0, 0.35, 5.25], fov: isMobileLandscape ? 34 : 28 }}
                gl={{ antialias: true, alpha: true }}
              >
                <HorseCardScene tile={item.tile} revealed={revealed} revealDelayMs={1000 + index * 1700} />
              </Canvas>
              {isBuyOneGetOne ? (
                <div
                  className={`pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded-full border border-gold/30 bg-black/35 px-2 py-0.5 font-semibold text-gold-soft ${
                    isMobileLandscape ? "text-[10px]" : "text-xs"
                  }`}
                >
                  {index === 0 ? "第一张" : "送一张"}
                </div>
              ) : null}
            </div>
          ))}
          <div className="pointer-events-none absolute inset-x-6 bottom-3 h-8 rounded-full bg-gold/25 blur-xl" />
        </div>

        <div
          className={`text-center transition-all duration-300 ${
            detailsVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <div className={`${isMobileLandscape ? "text-base" : "text-xl"} font-bold text-gold-soft`}>{summary.label}</div>
          <div className={`${isMobileLandscape ? "mt-0 text-xs" : "mt-1 text-sm"} text-slate-300`}>
            {isBuyOneGetOne ? "买一送一" : "点数"} {summary.value}
          </div>
          <div className={`${isMobileLandscape ? "mt-0.5 text-lg" : "mt-2 text-2xl"} font-bold text-jade-soft`}>
            额外 +{summary.bonus}
          </div>
        </div>
      </div>
    </div>
  );
}
