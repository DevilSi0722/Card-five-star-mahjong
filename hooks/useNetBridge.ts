"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { useRoomStore } from "@/store/roomStore";
import { cropSnapshotForSeat, rotateWindsForSeat } from "@/lib/multiplayer/seatRotation";
import { engineSeatForClient, engineSeatWinds, resolveEngineSeats } from "@/lib/multiplayer/windSeating";
import {
  beginNextRound,
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
 * - host：按风位推导座位 → 跑引擎；订阅动作套用；引擎变化时为每个座位发布裁剪+旋转视图（含风位）；心跳。
 * - guest：从房间玩家+风位推导自己的引擎座位 → 订阅该座位视图渲染；本地动作转发给房主；心跳。
 * - single：完全不介入。
 */
export function useNetBridge() {
  const room = useRoomStore((s) => s.room);
  const isHost = useRoomStore((s) => s.isHost());
  const clientId = useRoomStore((s) => s.clientId);
  const revRef = useRef(0);
  const lastViewRevRef = useRef(-1);
  const lastPublishSigRef = useRef("");
  // host 已发牌到的局号，避免同一局重复发牌。
  const dealtRoundRef = useRef(0);

  const code = room?.code ?? null;
  const isMultiplayer = Boolean(room);
  const roomStatus = room?.status ?? null;
  const currentRound = room?.currentRound ?? 0;

  // 由房间玩家+风位推导出的引擎座位映射（仅三人就座、含房主时有效）。
  const engineSeats = useMemo(() => (room ? resolveEngineSeats(room.players) : null), [room]);
  // 真实座位 → 风位（host 视角）。
  const realWinds = useMemo(() => (room ? engineSeatWinds(room.players) : null), [room]);
  // 本客户端的引擎座位。
  const mySeat = useMemo(
    () => (room ? engineSeatForClient(room.players, clientId) : null),
    [room, clientId],
  );
  const guestViewSeats = useMemo(() => {
    if (!room) return [];
    return room.players
      .filter((player) => !player.isAi && player.clientId !== room.hostClientId)
      .map((player) => engineSeatForClient(room.players, player.clientId))
      .filter((seat): seat is EngineSeatId => Boolean(seat));
  }, [room]);

  // guest：座位推导出来后校正本地 netSeat（join 时用的是占位座位）。
  useEffect(() => {
    if (isHost || !mySeat) return;
    useGameStore.getState().setNetSeat(mySeat);
  }, [isHost, mySeat]);

  // host：按风位推导的座位名册修正玩家类型/昵称（区分真人与 AI 补位）。
  useEffect(() => {
    if (!isHost || !engineSeats) return;
    const roster: Partial<Record<EngineSeatId, { name: string; isAi: boolean }>> = {};
    for (const seat of ENGINE_SEATS) {
      const player = engineSeats[seat];
      roster[seat] = { name: player.name, isAi: player.isAi };
    }
    useGameStore.getState().applyNetRoster(roster);
  }, [isHost, engineSeats]);

  // 本地保存自己视角下的风位（用于在玩家名下显示），host 与 guest 都需要。
  useEffect(() => {
    if (!realWinds || !mySeat) return;
    useGameStore.getState().setNetWinds(rotateWindsForSeat(realWinds, mySeat));
  }, [realWinds, mySeat]);

  // host：每当 currentRound 推进到新局号时发牌一次（首局及后续准备开局共用此路径）。
  useEffect(() => {
    if (!isHost || roomStatus !== "playing" || !room || currentRound < 1) return;
    if (dealtRoundRef.current >= currentRound) return;
    dealtRoundRef.current = currentRound;
    const store = useGameStore.getState();
    // 先把房间设置写入引擎，再发牌（底分、亮倒自摸买马）。
    store.saveNextRoundSettings({
      baseScore: room.settings.baseScore,
      liangDaoZimoBuyHorseEnabled: room.settings.liangDaoZimoBuyHorse,
    });
    store.startNewRound();
  }, [isHost, roomStatus, room, currentRound]);

  // host：本局结算后，所有真人玩家点「准备」则自动开下一局（递增局号 + 清空准备名单）。
  // 已打满设定局数（currentRound >= settings.rounds）时不再开新局。
  useEffect(() => {
    if (!isHost || !code || !room || roomStatus !== "playing") return;
    if (currentRound >= room.settings.rounds) return;
    const store = useGameStore.getState();
    const settled = store.phase === "settled" || store.phase === "draw";
    if (!settled) return;
    const humans = room.players.filter((p) => !p.isAi);
    const ready = new Set(room.readyClients ?? []);
    const allReady = humans.length > 0 && humans.every((p) => ready.has(p.clientId));
    if (allReady) {
      void beginNextRound(code, currentRound + 1);
    }
  }, [isHost, code, room, roomStatus, currentRound]);

  // host：订阅动作队列，套用到引擎后删除。
  useEffect(() => {
    if (!isHost || !code) return;
    const unsub = subscribeActions(code, (action) => {
      applyActionToEngine(action.type, action.seat, action);
      void consumeAction(code, action.id);
    });
    return () => unsub();
  }, [isHost, code]);

  // host：引擎状态变化时为真人 guest 发布裁剪 + 旋转后的视图（含旋转后的风位）。
  useEffect(() => {
    if (!isHost || !code || !realWinds) return;
    const publish = () => {
      const state = useGameStore.getState();
      // 仅在「有意义的对局变化」时发布，跳过选牌/悬浮等纯 UI 变化，降低 Firestore 写入量。
      const signature = `${state.actionNonce}|${state.phase}|${state.roundResult ? "r" : "-"}`;
      if (signature === lastPublishSigRef.current) return;
      lastPublishSigRef.current = signature;

      const snapshot = extractSnapshot(state);
      revRef.current += 1;
      const rev = revRef.current;
      for (const seat of guestViewSeats) {
        void publishView(code, {
          forSeat: seat,
          rev,
          state: cropSnapshotForSeat(snapshot, seat),
          winds: rotateWindsForSeat(realWinds, seat),
        });
      }
    };
    publish();
    const unsub = useGameStore.subscribe(publish);
    return () => unsub();
  }, [isHost, code, realWinds, guestViewSeats]);

  // guest：订阅本座位视图，渲染到本地 store（含风位）。
  useEffect(() => {
    if (isHost || !code || !mySeat) return;
    const unsub = subscribeView(code, mySeat, (view) => {
      if (!view || view.rev <= lastViewRevRef.current) return;
      lastViewRevRef.current = view.rev;
      const store = useGameStore.getState();
      store.applyNetSnapshot(view.state);
      if (view.winds) store.setNetWinds(view.winds);
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
