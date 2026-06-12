"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/store/gameStore";
import { analyzeWin } from "@/utils/mahjong/handAnalyzer";
import { actionDelay } from "@/utils/mahjong/rules";
import { chooseDiscard, chooseGang, chooseReaction, shouldDeclareLiangDao } from "@/utils/mahjong/ai";

export function useAiTurn() {
  const snapshot = useGameStore(
    useShallow((state) => ({
      phase: state.phase,
      currentPlayerId: state.currentPlayerId,
      players: state.players,
      pendingReactions: state.pendingReactions,
      reactionPasses: state.reactionPasses,
      actionNonce: state.actionNonce,
      supplementContext: state.supplementContext,
    })),
  );

  useEffect(() => {
    if (snapshot.phase !== "playing") return;
    const player = snapshot.players[snapshot.currentPlayerId];
    const isAutomated = player.type === "ai" || player.autoPlay;
    if (!isAutomated) return;

    const timeout = window.setTimeout(() => {
      const latest = useGameStore.getState();
      if (latest.phase !== "playing" || latest.currentPlayerId !== player.id) return;
      const current = latest.players[player.id];
      const winningTile = current.hand.find((tile) => tile.id === current.lastDrawnTileId);
      const win = analyzeWin(current.hand, winningTile?.kind, current.melds);
      if (win.isWin) {
        if (current.type === "human") return;
        latest.claimHu(player.id);
        return;
      }

      if (current.isLiangDao || current.autoPlay) {
        const gang = chooseGang(current, { requireDrawnTile: true });
        if (current.type === "human" && gang) return;
        if (gang?.action === "an_gang" && gang.tileKind) {
          latest.claimAnGang(player.id, gang.tileKind);
          return;
        }
        if (gang?.action === "bu_gang" && gang.meldId) {
          latest.claimBuGang(player.id, gang.meldId);
          return;
        }

        const drawn = current.lastDrawnTileId
          ? current.hand.find((tile) => tile.id === current.lastDrawnTileId)
          : current.hand[current.hand.length - 1];
        if (drawn) latest.discardTile(player.id, drawn.id);
        return;
      }

      const gang = chooseGang(current);
      if (gang?.action === "an_gang" && gang.tileKind) {
        latest.claimAnGang(player.id, gang.tileKind);
        return;
      }
      if (gang?.action === "bu_gang" && gang.meldId) {
        latest.claimBuGang(player.id, gang.meldId);
        return;
      }

      const liangDao = shouldDeclareLiangDao(current, latest.players);
      if (liangDao?.tileId) {
        latest.declareLiangDao(player.id, liangDao.tileId);
        return;
      }

      const discard = chooseDiscard(current, latest.players);
      if (discard.action === "pass") {
        latest.settleNoSafeDiscard(player.id);
        return;
      }
      if (discard.tileId) latest.discardTile(player.id, discard.tileId);
    }, actionDelay());

    return () => window.clearTimeout(timeout);
  }, [snapshot.actionNonce, snapshot.currentPlayerId, snapshot.phase, snapshot.players, snapshot.supplementContext]);

  useEffect(() => {
    if (snapshot.phase !== "responding" || !snapshot.pendingReactions) return;
    const pending = snapshot.pendingReactions;
    const remaining = pending.options.filter((option) => !snapshot.reactionPasses.includes(option.playerId));
    if (remaining.length === 0) return;

    const firstHu = remaining.find((option) => option.canHu);
    const firstGang = remaining.find((option) => option.canGang);
    const firstPeng = remaining.find((option) => option.canPeng);
    const humanCanHu = remaining.some((option) => option.playerId === "human" && option.canHu);
    const option = firstHu ?? firstGang ?? firstPeng;
    if (!option) return;
    const player = snapshot.players[option.playerId];
    if (humanCanHu) return;
    const isAutomated = player.type === "ai" || player.autoPlay;
    if (!isAutomated) return;

    const timeout = window.setTimeout(() => {
      const latest = useGameStore.getState();
      if (latest.phase !== "responding" || !latest.pendingReactions) return;
      const currentOption = latest.pendingReactions.options.find(
        (item) => item.playerId === option.playerId,
      );
      if (!currentOption || latest.reactionPasses.includes(option.playerId)) return;
      const currentPlayer = latest.players[option.playerId];
      const decision = chooseReaction(
        currentPlayer,
        latest.pendingReactions.discard.tile,
        currentOption.canHu,
        currentOption.canGang,
        currentOption.canPeng,
      );

      if (decision.action === "hu") latest.claimHu(option.playerId);
      else if (decision.action === "ming_gang") latest.claimMingGang(option.playerId);
      else if (decision.action === "peng") latest.claimPeng(option.playerId);
      else latest.passReaction(option.playerId);
    }, actionDelay());

    return () => window.clearTimeout(timeout);
  }, [snapshot.actionNonce, snapshot.pendingReactions, snapshot.phase, snapshot.players, snapshot.reactionPasses]);
}
