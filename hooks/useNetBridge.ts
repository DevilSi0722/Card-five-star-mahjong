"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { useRoomStore } from "@/store/roomStore";
import { cropSnapshotForSeat } from "@/lib/multiplayer/seatRotation";
import {
  consumeAction,
  heartbeat,
  publishView,
  subscribeActions,
  subscribeView,
} from "@/lib/multiplayer/roomRepository";
import type {
  EngineSeatId,
  NetAction,
  NetActionType,
  NetGameSnapshot,
} from "@/types/multiplayer";

const ENGINE_SEATS: EngineSeatId[] = ["human", "ai_right", "ai_left"];

/** 从完整 store 状态抽出可发布的快照子集。 */
function extractSnapshot(state: ReturnType<typeof useGameStore.getState>): NetGameSnapshot {
  return {
    players: state.players,
    currentPlayerId: state.currentPlayerId,
    dealerId: state.dealerId,
    phase: state.phase,
    lastDiscard: state.lastDiscard,
    pendingReactions: state.pendingReactions,
    reactionPasses: state.reactionPasses,
    pendingBuGang: state.pendingBuGang,
    roundResult: state.roundResult,
    logs: state.logs,
    actionNonce: state.actionNonce,
    baseScore: state.baseScore,
    wall: state.wall,
  };
}

/** 把房主收到的 guest 动作套用到本地引擎。 */
function applyActionToEngine(type: NetActionType, seat: EngineSeatId, action: NetAction) {
  const store = useGameStore.getState();
  switch (type) {
    case "discard":
      if (action.tileId) store.discardTile(seat, action.tileId);
      break;
    case "peng":
      store.claimPeng(seat);
      break;
    case "ming_gang":
      store.claimMingGang(seat);
      break;
    case "an_gang":
      if (action.tileKind) store.claimAnGang(seat, action.tileKind);
      break;
    case "bu_gang":
      if (action.meldId) store.claimBuGang(seat, action.meldId);
      break;
    case "liang_dao":
      if (action.tileId) store.declareLiangDao(seat, action.tileId);
      break;
    case "hu":
      store.claimHu(seat);
      break;
    case "pass":
      store.passReaction(seat);
      break;
  }
}

/**
 * 联机对局桥接：
 * - host：跑引擎；订阅动作队列套用到引擎；引擎状态变化时为每个座位发布裁剪+旋转视图；心跳。
 * - guest：订阅本座位视图渲染；本地动作转发给房主；心跳。
 * - single：完全不介入。
 */
export function useNetBridge() {
  const room = useRoomStore((s) => s.room);
  const mySeat = useRoomStore((s) => s.mySeat);
  const isHost = useRoomStore((s) => s.isHost());
  const clientId = useRoomStore((s) => s.clientId);
  const revRef = useRef(0);
  const lastViewRevRef = useRef(-1);
  const lastPublishSigRef = useRef("");

  const code = room?.code ?? null;
  const isMultiplayer = Boolean(room && mySeat);
  const roomStatus = room?.status ?? null;

  // host：按房间名册修正座位玩家类型/昵称（区分真人与 AI 补位）。
  useEffect(() => {
    if (!isHost || !room) return;
    const roster: Partial<Record<EngineSeatId, { name: string; isAi: boolean }>> = {};
    for (const p of room.players) roster[p.seat] = { name: p.name, isAi: p.isAi };
    useGameStore.getState().applyNetRoster(roster);
  }, [isHost, room]);

  // host：房间进入 playing 状态后开始新一局（仅触发一次发牌）。
  useEffect(() => {
    if (!isHost || roomStatus !== "playing" || !room) return;
    const store = useGameStore.getState();
    if (store.phase === "ready" || store.phase === "settled" || store.phase === "draw") {
      // 先把房间设置写入引擎，再发牌（底分、亮倒自摸买马）。
      store.saveNextRoundSettings({
        baseScore: room.settings.baseScore,
        liangDaoZimoBuyHorseEnabled: room.settings.liangDaoZimoBuyHorse,
      });
      store.startNewRound();
    }
  }, [isHost, roomStatus, room]);

  // host：订阅动作队列，套用到引擎后删除。
  useEffect(() => {
    if (!isHost || !code) return;
    const unsub = subscribeActions(code, (action) => {
      applyActionToEngine(action.type, action.seat, action);
      void consumeAction(code, action.id);
    });
    return () => unsub();
  }, [isHost, code]);

  // host：引擎状态变化时为每个座位发布裁剪 + 旋转后的视图。
  useEffect(() => {
    if (!isHost || !code) return;
    const publish = () => {
      const state = useGameStore.getState();
      // 仅在「有意义的对局变化」时发布，跳过选牌/悬浮等纯 UI 变化，降低 Firestore 写入量。
      const signature = `${state.actionNonce}|${state.phase}|${state.roundResult ? "r" : "-"}`;
      if (signature === lastPublishSigRef.current) return;
      lastPublishSigRef.current = signature;

      const snapshot = extractSnapshot(state);
      revRef.current += 1;
      const rev = revRef.current;
      for (const seat of ENGINE_SEATS) {
        void publishView(code, { forSeat: seat, rev, state: cropSnapshotForSeat(snapshot, seat) });
      }
    };
    publish();
    const unsub = useGameStore.subscribe(publish);
    return () => unsub();
  }, [isHost, code]);

  // guest：订阅本座位视图，渲染到本地 store。
  useEffect(() => {
    if (isHost || !code || !mySeat) return;
    const unsub = subscribeView(code, mySeat, (view) => {
      if (!view || view.rev <= lastViewRevRef.current) return;
      lastViewRevRef.current = view.rev;
      useGameStore.getState().applyNetSnapshot(view.state);
    });
    return () => unsub();
  }, [isHost, code, mySeat]);

  // 心跳：定期刷新 lastSeen。
  useEffect(() => {
    if (!isMultiplayer || !code) return;
    const timer = window.setInterval(() => void heartbeat(code, clientId), 10000);
    return () => window.clearInterval(timer);
  }, [isMultiplayer, code, clientId]);
}
