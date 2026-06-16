"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActionAnnouncement, AnnouncementBadge, FanItem, PlayerId, ScoreResult, WinMethod } from "@/types/mahjong";

/**
 * 胡牌文字特效：在赢家座位上弹出「自摸/胡」印章式文字，
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
  return method === "zimo" || method === "gangshang" ? "自摸" : "胡";
}

function loserLabel(method: WinMethod): string {
  return method === "qianggang" ? "被抢杠" : "点炮";
}

export const ANNOUNCEMENT_STEP_MS = 1800;

function badgeToneClass(text: string, tone: AnnouncementBadge["tone"]): string {
  if (tone === "loser") return "win-callig--loser";
  if (text === "碰") return "win-callig--peng";
  if (text.includes("杠")) return "win-callig--gang";
  if (text === "亮倒") return "win-callig--liangdao";
  if (text.includes("清一色")) return "win-callig--qingyise";
  if (text.includes("七对")) return "win-callig--qidui";
  if (text.includes("三元")) return "win-callig--sanyuan";
  if (text.includes("卡五星")) return "win-callig--kawuxing";
  if (text.includes("碰碰胡")) return "win-callig--pengpenghu";
  if (text.includes("手抓一") || text.includes("海底")) return "win-callig--rare";
  return "win-callig--winner";
}

function badgeGlowClass(text: string, tone: AnnouncementBadge["tone"]): string {
  if (tone === "loser") return "bg-rose-500/50";
  if (text === "碰") return "bg-emerald-400/45";
  if (text.includes("杠")) return "bg-violet-500/45";
  if (text === "亮倒") return "bg-sky-400/45";
  if (text.includes("清一色")) return "bg-cyan-400/45";
  if (text.includes("七对")) return "bg-fuchsia-400/45";
  if (text.includes("三元")) return "bg-red-400/45";
  if (text.includes("卡五星")) return "bg-amber-300/50";
  if (text.includes("碰碰胡")) return "bg-lime-300/42";
  if (text.includes("手抓一") || text.includes("海底")) return "bg-indigo-400/45";
  return "bg-gold/55";
}

function specialFanLabels(fans: FanItem[]): string[] {
  return fans
    .filter((fan) => fan.type !== "base" && fan.type !== "liangdao")
    .map((fan) => (fan.name === "亮倒/明牌" ? "亮倒" : fan.name));
}

function getWinDetails(result: ScoreResult) {
  return (
    result.winDetails ??
    (result.winnerId && result.method
      ? [
          {
            winnerId: result.winnerId,
            loserId: result.loserId,
            method: result.method,
            fans: result.fans,
            totalFan: result.totalFan,
            baseScore: result.baseScore,
            multiplier: result.multiplier,
            title: result.title,
          },
        ]
      : [])
  );
}

export function getWinAnnouncementStepCount(result: ScoreResult): number {
  const details = getWinDetails(result);
  if (details.length === 0) return 0;
  return 1 + Math.max(0, ...details.map((detail) => specialFanLabels(detail.fans).length));
}

function buildBadges(result: ScoreResult, step: number): AnnouncementBadge[] {
  const details = getWinDetails(result);
  if (details.length === 0) return [];

  if (step === 0) {
    const list: AnnouncementBadge[] = details.map((detail) => ({
      playerId: detail.winnerId,
      text: winnerLabel(detail.method),
      tone: "winner" as const,
    }));

    // 点炮/抢杠：在放炮者座位加一枚红色标记（赢家可能多位，放炮者唯一）。
    const fired = details.find((detail) => detail.loserId);
    if (fired?.loserId && !list.some((badge) => badge.playerId === fired.loserId)) {
      list.push({ playerId: fired.loserId, text: loserLabel(fired.method), tone: "loser" });
    }
    return list;
  }

  return details.flatMap((detail) => {
    const label = specialFanLabels(detail.fans)[step - 1];
    return label ? [{ playerId: detail.winnerId, text: label, tone: "winner" as const }] : [];
  });
}

export function WinAnnouncementOverlay({
  announcement,
  result,
  step = 0,
}: {
  announcement?: ActionAnnouncement;
  result?: ScoreResult;
  step?: number;
}) {
  const [visible, setVisible] = useState(false);

  const badges = useMemo<AnnouncementBadge[]>(
    () => announcement?.badges ?? (result ? buildBadges(result, step) : []),
    [announcement, result, step],
  );

  useEffect(() => {
    setVisible(false);
    const timer = window.setTimeout(() => setVisible(true), 30);
    return () => window.clearTimeout(timer);
  }, [announcement?.id, step]);

  if (badges.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {badges.map((badge) => (
        <div key={`${badge.playerId}-${badge.text}-${badge.tone}`} className={`absolute ${SEAT_POSITION[badge.playerId]}`}>
          {visible ? (
            <div className="relative flex items-center justify-center">
              <span
                className={`win-stamp-glow absolute inset-0 rounded-full blur-3xl ${badgeGlowClass(badge.text, badge.tone)}`}
              />
              <span
                className={`win-callig relative inline-flex items-center justify-center px-2 font-bold leading-none tracking-[0.08em] text-7xl sm:text-8xl ${badgeToneClass(
                  badge.text,
                  badge.tone,
                )}`}
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
