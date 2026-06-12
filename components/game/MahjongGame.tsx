"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useAiTurn } from "@/hooks/useAiTurn";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { GameCanvas } from "./GameCanvas";
import { GameHUD } from "./GameHUD";
import { AmbientLights } from "./AmbientLights";
import { TingInfoBar } from "./TingInfoBar";
import { HumanHandOverlay } from "./HumanHandOverlay";
import { BuyHorseRevealOverlay } from "./BuyHorseRevealOverlay";
import { SettlementModal } from "./SettlementModal";

export function MahjongGame() {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const startNewRound = useGameStore((state) => state.startNewRound);
  const roundResult = useGameStore((state) => state.roundResult);
  const selectedTileId = useGameStore((state) => state.selectedTileId);
  const selectTile = useGameStore((state) => state.selectTile);
  const [showSettlement, setShowSettlement] = useState(false);
  useAiTurn();

  useEffect(() => {
    startNewRound();
  }, [startNewRound]);

  useEffect(() => {
    if (!roundResult) {
      setShowSettlement(false);
      return undefined;
    }
    if (!roundResult.buyHorse) {
      setShowSettlement(true);
      return undefined;
    }

    setShowSettlement(false);
    const timer = window.setTimeout(() => setShowSettlement(true), 3500);
    return () => window.clearTimeout(timer);
  }, [roundResult]);

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
      {roundResult?.buyHorse && !showSettlement ? <BuyHorseRevealOverlay result={roundResult.buyHorse} /> : null}
      {roundResult && showSettlement ? <SettlementModal result={roundResult} /> : null}
    </main>
  );
}
