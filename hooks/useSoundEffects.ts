"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { playSound, setMuted } from "@/lib/audio/soundEngine";

/**
 * 监听 gameStore 的日志变化，将最新一条日志映射为对应音效。
 * 单机与联机 guest（applyNetSnapshot 后日志同样更新）均生效。
 * 用日志（而非 phase）驱动：phase 在摸牌/碰/杠后都会回到 playing，无法区分事件。
 */
export function useSoundEffects(): void {
  const logs = useGameStore((state) => state.logs);
  const soundEnabled = useUiStore((state) => state.soundEnabled);
  // 记录上次发声的日志内容。logs 上限 8 条（pushLog 会 slice(-8)），
  // 满 8 条后长度不再变化，必须比对内容而非长度，否则会漏音。
  const prevLatestRef = useRef<string | null>(null);

  useEffect(() => {
    setMuted(!soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    const latest = logs[logs.length - 1];
    if (!latest || latest === prevLatestRef.current) return;
    const isFirst = prevLatestRef.current === null;
    prevLatestRef.current = latest;
    // 首次挂载时不补播历史最后一条（避免重连/重挂载误触发）。
    if (isFirst) return;

    if (/打出/.test(latest)) {
      playSound("discard");
    }
  }, [logs]);
}
