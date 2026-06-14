"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { SRGBColorSpace } from "three";
import type { PerspectiveCamera } from "three";
import { useGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { MahjongTable } from "@/components/three/MahjongTable";
import { PlayerHand3D } from "@/components/three/PlayerHand3D";
import { DiscardArea3D } from "@/components/three/DiscardArea3D";
import { PhysicsDiscardArea3D } from "@/components/three/PhysicsDiscardArea3D";
import { MeldArea3D } from "@/components/three/MeldArea3D";
import { TurnIndicator3D } from "@/components/three/TurnIndicator3D";
import { ALL_TILE_TEXTURE_SRCS } from "@/utils/mahjong/tileTextures";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";

// 启动即预加载全部牌面贴图，避免游戏中途首次加载触发 Suspense 导致画面闪黑
useTexture.preload(ALL_TILE_TEXTURE_SRCS);

const MAX_RENDER_WIDTH = 1920;
const MAX_RENDER_HEIGHT = 1080;

function getCappedCanvasDpr(mobileLandscape: boolean) {
  if (typeof window === "undefined") return 1;
  const viewport = window.visualViewport;
  const width = Math.max(1, viewport?.width ?? window.innerWidth);
  const height = Math.max(1, viewport?.height ?? window.innerHeight);
  const maxDpr = mobileLandscape ? 1.5 : 1;
  return Math.min(maxDpr, MAX_RENDER_WIDTH / width, MAX_RENDER_HEIGHT / height);
}

function useCappedCanvasDpr(mobileLandscape: boolean) {
  const [dpr, setDpr] = useState(() => getCappedCanvasDpr(mobileLandscape));

  useEffect(() => {
    function update() {
      setDpr(getCappedCanvasDpr(mobileLandscape));
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [mobileLandscape]);

  return dpr;
}

function FixedCamera({ mobileLandscape }: { mobileLandscape: boolean }) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const perspectiveCamera = camera as PerspectiveCamera;
    if (mobileLandscape) {
      perspectiveCamera.position.set(0, 7.15, 4.35);
      perspectiveCamera.fov = 39;
      perspectiveCamera.lookAt(0, -0.05, -0.18);
    } else {
      perspectiveCamera.position.set(0, 6.8, 4.1);
      perspectiveCamera.fov = 40;
      perspectiveCamera.lookAt(0, 0.12, 0);
    }
    perspectiveCamera.updateProjectionMatrix();
  }, [camera, mobileLandscape]);

  return null;
}

function LoadingTableFallback() {
  return (
    <group scale={[1.16, 1.16, 1.16]}>
      <MahjongTable textured={false} />
    </group>
  );
}

function TileTextureWarmup() {
  const gl = useThree((state) => state.gl);
  const textures = useTexture(ALL_TILE_TEXTURE_SRCS);

  useEffect(() => {
    for (const texture of textures) {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 16;
      texture.needsUpdate = true;
      gl.initTexture(texture);
    }
  }, [gl, textures]);

  return null;
}

export function GameCanvas() {
  const players = useGameStore((state) => state.players);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const phase = useGameStore((state) => state.phase);
  const discardPhysicsEnabled = useUiStore((state) => state.discardPhysicsEnabled);
  const tableclothId = useUiStore((state) => state.tableclothId);
  const { isMobileLandscape } = useResponsiveGameLayout();
  const canvasDpr = useCappedCanvasDpr(isMobileLandscape);

  // 牌局结束（结算/流局）时，三家手牌全部亮出并平放
  const revealAll = phase === "settled" || phase === "draw";
  const showHumanTableHand = revealAll || players.human.isLiangDao;
  const turnIndicatorActive = phase !== "settled" && phase !== "draw";

  return (
    <Canvas
      shadows
      dpr={canvasDpr}
      camera={{
        position: isMobileLandscape ? [0, 7.15, 4.35] : [0, 6.8, 4.1],
        fov: isMobileLandscape ? 39 : 40,
      }}
      className="absolute inset-0"
      gl={{ antialias: true }}
    >
      <FixedCamera mobileLandscape={isMobileLandscape} />
      <color attach="background" args={["#081418"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 7, 4]} intensity={1.8} castShadow />
      <hemisphereLight args={["#d8f6ff", "#19362f", 0.45]} />
      <Suspense fallback={<LoadingTableFallback />}>
        <TileTextureWarmup />
        <group
          position={isMobileLandscape ? [0, 0, -0.58] : [0, 0, 0]}
          scale={isMobileLandscape ? [1.25, 1.25, 1.25] : [1.16, 1.16, 1.16]}
        >
          <MahjongTable tableclothId={tableclothId} />

          <TurnIndicator3D
            players={players}
            currentPlayerId={currentPlayerId}
            active={turnIndicatorActive}
          />

          {showHumanTableHand ? (
            <PlayerHand3D
              player={players.human}
              current={currentPlayerId === "human" && phase === "playing"}
              revealAll={revealAll}
              scale={isMobileLandscape ? 0.66 : 0.72}
              compact={isMobileLandscape}
            />
          ) : null}
          <PlayerHand3D
            player={players.ai_left}
            current={currentPlayerId === "ai_left" && phase === "playing"}
            revealAll={revealAll}
            scale={isMobileLandscape ? 0.64 : 0.72}
            compact={isMobileLandscape}
            showWaitingPreview
          />
          <PlayerHand3D
            player={players.ai_right}
            current={currentPlayerId === "ai_right" && phase === "playing"}
            revealAll={revealAll}
            scale={isMobileLandscape ? 0.64 : 0.72}
            compact={isMobileLandscape}
            showWaitingPreview
          />

          {discardPhysicsEnabled ? (
            <PhysicsDiscardArea3D players={[players.human, players.ai_left, players.ai_right]} />
          ) : (
            <>
              <DiscardArea3D player={players.human} />
              <DiscardArea3D player={players.ai_left} />
              <DiscardArea3D player={players.ai_right} />
            </>
          )}

          <MeldArea3D player={players.human} />
          <MeldArea3D player={players.ai_left} />
          <MeldArea3D player={players.ai_right} />
        </group>
      </Suspense>
    </Canvas>
  );
}
