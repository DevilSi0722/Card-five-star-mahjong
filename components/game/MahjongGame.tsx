"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useAiTurn } from "@/hooks/useAiTurn";
import { useNetBridge } from "@/hooks/useNetBridge";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { GameCanvas } from "./GameCanvas";
import { GameHUD } from "./GameHUD";
import { AmbientLights } from "./AmbientLights";
import { TingInfoBar } from "./TingInfoBar";
import { HumanHandOverlay } from "./HumanHandOverlay";
import { BuyHorseRevealOverlay } from "./BuyHorseRevealOverlay";
import { SettlementModal } from "./SettlementModal";

export function MahjongGame() {
  const { width, height, isMobileLandscape } = useResponsiveGameLayout();
  const startNewRound = useGameStore((state) => state.startNewRound);
  const roundResult = useGameStore((state) => state.roundResult);
  const selectedTileId = useGameStore((state) => state.selectedTileId);
  const selectTile = useGameStore((state) => state.selectTile);
  const netRole = useGameStore((state) => state.netRole);
  const [showSettlement, setShowSettlement] = useState(false);
  useAiTurn();
  useNetBridge();

  useEffect(() => {
    // 单机模式直接开局；联机模式由房主根据房间状态触发发牌，guest 仅渲染。
    if (netRole === "single") startNewRound();
  }, [startNewRound, netRole]);

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
      className={`game-shell relative overflow-hidden bg-[#071014] ${
        isMobileLandscape ? "game-shell--mobile-landscape" : ""
      }`}
      style={{
        width: width > 0 ? `${width}px` : "100vw",
        height: height > 0 ? `${height}px` : "100dvh",
      }}
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
