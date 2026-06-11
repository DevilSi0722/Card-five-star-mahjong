"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Environment, useTexture } from "@react-three/drei";
import { useGameStore } from "@/store/gameStore";
import { MahjongTable } from "@/components/three/MahjongTable";
import { PlayerHand3D } from "@/components/three/PlayerHand3D";
import { DiscardArea3D } from "@/components/three/DiscardArea3D";
import { MeldArea3D } from "@/components/three/MeldArea3D";
import { TurnIndicator3D } from "@/components/three/TurnIndicator3D";
import { ALL_TILE_TEXTURE_SRCS } from "@/utils/mahjong/tileTextures";

// 启动即预加载全部牌面贴图，避免游戏中途首次加载触发 Suspense 导致画面闪黑
useTexture.preload(ALL_TILE_TEXTURE_SRCS);

function FixedCamera() {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.position.set(0, 4.6, 5.2);
    camera.lookAt(0, 0.25, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

export function GameCanvas() {
  const players = useGameStore((state) => state.players);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const selectedTileId = useGameStore((state) => state.selectedTileId);
  const phase = useGameStore((state) => state.phase);
  const wallCount = useGameStore((state) => state.wall.length);
  const selectTile = useGameStore((state) => state.selectTile);
  const discardTile = useGameStore((state) => state.discardTile);

  // 牌局结束（结算/流局）时，三家手牌全部亮出并平放
  const revealAll = phase === "settled" || phase === "draw";

  return (
    <Canvas
      shadows
      camera={{ position: [0, 4.6, 5.2], fov: 48 }}
      className="absolute inset-0"
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <FixedCamera />
      <color attach="background" args={["#081418"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 7, 4]} intensity={1.8} castShadow />
      <Suspense fallback={null}>
        <Environment preset="city" />
        <MahjongTable wallCount={wallCount} />

        <TurnIndicator3D
          players={players}
          currentPlayerId={currentPlayerId}
          active={phase === "playing"}
        />

        <PlayerHand3D
          player={players.human}
          current={currentPlayerId === "human" && phase === "playing"}
          revealAll={revealAll}
          selectedTileId={selectedTileId}
          onTileClick={(tileId) => selectTile(tileId)}
          onTileDoubleClick={(tileId) => {
            if (phase === "playing" && currentPlayerId === "human" && !players.human.autoPlay) {
              discardTile("human", tileId);
            }
          }}
        />
        <PlayerHand3D
          player={players.ai_left}
          current={currentPlayerId === "ai_left" && phase === "playing"}
          revealAll={revealAll}
        />
        <PlayerHand3D
          player={players.ai_right}
          current={currentPlayerId === "ai_right" && phase === "playing"}
          revealAll={revealAll}
        />

        <DiscardArea3D player={players.human} />
        <DiscardArea3D player={players.ai_left} />
        <DiscardArea3D player={players.ai_right} />

        <MeldArea3D player={players.human} />
        <MeldArea3D player={players.ai_left} />
        <MeldArea3D player={players.ai_right} />
      </Suspense>
    </Canvas>
  );
}
