"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { useAiTurn } from "@/hooks/useAiTurn";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { GameCanvas } from "./GameCanvas";
import { GameHUD } from "./GameHUD";
import { AmbientLights } from "./AmbientLights";
import { TingInfoBar } from "./TingInfoBar";
import { HumanHandOverlay } from "./HumanHandOverlay";
import { SettlementModal } from "./SettlementModal";

export function MahjongGame() {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const startNewRound = useGameStore((state) => state.startNewRound);
  const roundResult = useGameStore((state) => state.roundResult);
  const selectedTileId = useGameStore((state) => state.selectedTileId);
  const selectTile = useGameStore((state) => state.selectTile);
  useAiTurn();

  useEffect(() => {
    startNewRound();
  }, [startNewRound]);

  return (
    <main
      className={`game-shell relative h-dvh w-screen overflow-hidden bg-[#071014] ${
        isMobileLandscape ? "game-shell--mobile-landscape" : ""
      }`}
      onPointerDown={() => {
        if (selectedTileId) selectTile(undefined);
      }}
    >
      <GameCanvas />
      <GameHUD />
      <HumanHandOverlay />
      <AmbientLights />
      <TingInfoBar />
      {roundResult ? <SettlementModal result={roundResult} /> : null}
    </main>
  );
}
