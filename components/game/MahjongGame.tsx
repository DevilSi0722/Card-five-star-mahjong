"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useAiTurn } from "@/hooks/useAiTurn";
import { useNetBridge } from "@/hooks/useNetBridge";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { unlockAudio } from "@/lib/audio/soundEngine";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { GameCanvas } from "./GameCanvas";
import { GameHUD } from "./GameHUD";
import { AmbientLights } from "./AmbientLights";
import { TingInfoBar } from "./TingInfoBar";
import { HumanHandOverlay } from "./HumanHandOverlay";
import { BuyHorseRevealOverlay } from "./BuyHorseRevealOverlay";
import { SettlementModal } from "./SettlementModal";
import { ANNOUNCEMENT_STEP_MS, getWinAnnouncementStepCount, WinAnnouncementOverlay } from "./WinAnnouncementOverlay";

export function MahjongGame() {
  const { width, height, isMobileLandscape } = useResponsiveGameLayout();
  const startNewRound = useGameStore((state) => state.startNewRound);
  const roundResult = useGameStore((state) => state.roundResult);
  const selectedTileId = useGameStore((state) => state.selectedTileId);
  const selectTile = useGameStore((state) => state.selectTile);
  const netRole = useGameStore((state) => state.netRole);
  const actionAnnouncement = useGameStore((state) => state.actionAnnouncement);
  const [showSettlement, setShowSettlement] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [winAnnouncementStep, setWinAnnouncementStep] = useState(0);
  const [activeActionAnnouncement, setActiveActionAnnouncement] = useState(actionAnnouncement);
  useAiTurn();
  useNetBridge();
  useSoundEffects();

  useEffect(() => {
    if (!isMobileLandscape) return undefined;

    const root = document.documentElement;
    const body = document.body;
    root.classList.add("mobile-game-locked");
    body.classList.add("mobile-game-locked");
    window.scrollTo(0, 0);

    const preventPageDrag = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".hud-scrollbar")) return;
      event.preventDefault();
    };

    document.addEventListener("touchmove", preventPageDrag, { passive: false });
    return () => {
      document.removeEventListener("touchmove", preventPageDrag);
      root.classList.remove("mobile-game-locked");
      body.classList.remove("mobile-game-locked");
    };
  }, [isMobileLandscape]);

  useEffect(() => {
    // 单机模式直接开局；联机模式由房主根据房间状态触发发牌，guest 仅渲染。
    if (netRole === "single") startNewRound();
  }, [startNewRound, netRole]);

  useEffect(() => {
    if (!roundResult) {
      setShowSettlement(false);
      setShowAnnouncement(false);
      setWinAnnouncementStep(0);
      return undefined;
    }

    // 有赢家时先在其座位弹出文字特效，再进入买马/结算；流局无赢家则跳过。
    const hasWinner = Boolean(roundResult.winnerId || (roundResult.winDetails?.length ?? 0) > 0);
    const stepCount = getWinAnnouncementStepCount(roundResult);
    const announcementMs = Math.max(ANNOUNCEMENT_STEP_MS, stepCount * ANNOUNCEMENT_STEP_MS);

    const proceed = () => {
      setShowAnnouncement(false);
      setWinAnnouncementStep(0);
      if (!roundResult.buyHorse) {
        setShowSettlement(true);
        return;
      }
      setShowSettlement(false);
      const revealDuration = roundResult.buyHorse.isBuyOneGetOne ? 5200 : 3500;
      buyHorseTimer = window.setTimeout(() => setShowSettlement(true), revealDuration);
    };

    let buyHorseTimer: number | undefined;
    let announcementTimer: number | undefined;
    let stepTimer: number | undefined;

    setShowSettlement(false);
    if (hasWinner) {
      setActiveActionAnnouncement(undefined);
      setShowAnnouncement(true);
      setWinAnnouncementStep(0);
      if (stepCount > 1) {
        stepTimer = window.setInterval(() => {
          setWinAnnouncementStep((current) => Math.min(current + 1, stepCount - 1));
        }, ANNOUNCEMENT_STEP_MS);
      }
      announcementTimer = window.setTimeout(proceed, announcementMs);
    } else {
      setShowAnnouncement(false);
      proceed();
    }

    return () => {
      if (announcementTimer) window.clearTimeout(announcementTimer);
      if (stepTimer) window.clearInterval(stepTimer);
      if (buyHorseTimer) window.clearTimeout(buyHorseTimer);
    };
  }, [roundResult]);

  useEffect(() => {
    if (!actionAnnouncement || roundResult) return;
    setActiveActionAnnouncement(actionAnnouncement);
  }, [actionAnnouncement, roundResult]);

  useEffect(() => {
    if (!activeActionAnnouncement || roundResult) {
      if (roundResult) setActiveActionAnnouncement(undefined);
      return undefined;
    }
    const timer = window.setTimeout(() => setActiveActionAnnouncement(undefined), ANNOUNCEMENT_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [activeActionAnnouncement, roundResult]);

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
        unlockAudio();
        if (selectedTileId) selectTile(undefined);
      }}
    >
      <GameCanvas />
      <GameHUD />
      <HumanHandOverlay />
      <AmbientLights />
      <TingInfoBar />
      {activeActionAnnouncement && !roundResult && !showAnnouncement ? (
        <WinAnnouncementOverlay announcement={activeActionAnnouncement} />
      ) : null}
      {roundResult && showAnnouncement ? (
        <WinAnnouncementOverlay key={`${roundResult.title}-${winAnnouncementStep}`} result={roundResult} step={winAnnouncementStep} />
      ) : null}
      {roundResult?.buyHorse && !showSettlement && !showAnnouncement ? <BuyHorseRevealOverlay result={roundResult.buyHorse} /> : null}
      {roundResult && showSettlement ? <SettlementModal result={roundResult} /> : null}
    </main>
  );
}
