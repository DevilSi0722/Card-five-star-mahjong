"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlayerId, ScoreResult, WinMethod } from "@/types/mahjong";

/**
 * 胡牌文字特效：在赢家座位上弹出「自摸/胡/抢杠胡」印章式文字，
 * 点炮局额外在放炮者座位上弹出「点炮」。单机与联机（guest 渲染快照）共用，
 * 由 MahjongGame 在 roundResult 出现且存在赢家时短暂渲染，结束后再进入买马/结算。
 */

// 各引擎座位在屏幕上的大致位置（已按本机视角旋转，human 恒在底部）。
const SEAT_POSITION: Record<PlayerId, string> = {
  human: "bottom-[30%] left-1/2 -translate-x-1/2",
  ai_left: "top-[44%] left-[19%] -translate-y-1/2",
  ai_right: "top-[44%] right-[19%] translate-x-0 -translate-y-1/2",
};

function winnerLabel(method: WinMethod): string {
  switch (method) {
    case "zimo":
      return "自摸";
    case "gangshang":
      return "杠上开花";
    case "qianggang":
      return "抢杠胡";
    default:
      return "胡";
  }
}

function loserLabel(method: WinMethod): string {
  return method === "qianggang" ? "被抢杠" : "点炮";
}

interface Badge {
  id: PlayerId;
  text: string;
  tone: "winner" | "loser";
}

export function WinAnnouncementOverlay({ result }: { result: ScoreResult }) {
  const [visible, setVisible] = useState(false);

  const badges = useMemo<Badge[]>(() => {
    const details =
      result.winDetails ??
      (result.winnerId && result.method
        ? [{ winnerId: result.winnerId, loserId: result.loserId, method: result.method }]
        : []);
    if (details.length === 0) return [];

    const list: Badge[] = details.map((detail) => ({
      id: detail.winnerId,
      text: winnerLabel(detail.method),
      tone: "winner" as const,
    }));

    // 点炮/抢杠：在放炮者座位加一枚红色标记（赢家可能多位，放炮者唯一）。
    const fired = details.find((detail) => detail.loserId);
    if (fired?.loserId && !list.some((badge) => badge.id === fired.loserId)) {
      list.push({ id: fired.loserId, text: loserLabel(fired.method), tone: "loser" });
    }
    return list;
  }, [result.method, result.loserId, result.winnerId, result.winDetails]);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 30);
    return () => window.clearTimeout(timer);
  }, []);

  if (badges.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {badges.map((badge) => (
        <div key={`${badge.id}-${badge.tone}`} className={`absolute ${SEAT_POSITION[badge.id]}`}>
          {visible ? (
            <div className="relative flex items-center justify-center">
              <span
                className={`win-stamp-glow absolute inset-0 rounded-full blur-3xl ${
                  badge.tone === "winner" ? "bg-gold/55" : "bg-rose-500/50"
                }`}
              />
              <span
                className={`win-callig relative inline-flex items-center justify-center px-2 font-bold leading-none tracking-[0.08em] text-7xl sm:text-8xl ${
                  badge.tone === "winner" ? "win-callig--winner" : "win-callig--loser"
                }`}
              >
                {badge.text}
              </span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
