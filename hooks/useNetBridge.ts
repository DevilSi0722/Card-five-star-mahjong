"use client";

import { useEffect, useRef } from "react";
import { subscribeGameView } from "@/lib/multiplayer/realtimeClient";
import { useRoomStore } from "@/store/roomStore";
import { useGameStore } from "@/store/gameStore";

/** 服务端权威联机桥接：浏览器只渲染自身视角的脱敏快照。 */
export function useNetBridge() {
  const room = useRoomStore((state) => state.room);
  const lastRevision = useRef(-1);

  useEffect(() => {
    if (!room || room.status !== "playing") return;
    lastRevision.current = -1;
    return subscribeGameView((view) => {
      if (view.round !== room.currentRound || view.rev < lastRevision.current) return;
      lastRevision.current = view.rev;
      const game = useGameStore.getState();
      game.applyNetSnapshot(view.state);
      game.setNetWinds(view.winds);
      game.setNetSeat("human");
    });
  }, [room?.code, room?.status, room?.currentRound]);
}
