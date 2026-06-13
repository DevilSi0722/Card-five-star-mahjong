"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, CircleDot, LogOut, RotateCcw, Settings, X } from "lucide-react";
import type { Player } from "@/types/mahjong";
import { WIND_LABEL, type EngineSeatId, type Wind } from "@/types/multiplayer";
import { useGameStore } from "@/store/gameStore";
import { useRoomStore } from "@/store/roomStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { analyzeWin, getAnGangKinds, getTingDiscardOptions } from "@/utils/mahjong/handAnalyzer";
import { ActionPanel } from "./ActionPanel";

// 每位玩家一套配色，让信息栏中不同玩家一眼可辨
const PLAYER_TONES: Array<{ name: string; chip: string; dot: string; text: string }> = [
  { name: "你", chip: "border-emerald-300/35 bg-emerald-400/15 text-emerald-100", dot: "bg-emerald-400", text: "text-emerald-100" },
  { name: "左家 AI", chip: "border-sky-300/35 bg-sky-400/15 text-sky-100", dot: "bg-sky-400", text: "text-sky-100" },
  { name: "右家 AI", chip: "border-amber-300/35 bg-amber-400/15 text-amber-100", dot: "bg-amber-400", text: "text-amber-100" },
];

function playerTone(name: string) {
  return PLAYER_TONES.find((tone) => tone.name === name);
}

// 牌桌左右两侧玩家名称标签（多人模式用，让左右两位玩家身份一眼可辨）。
function SideNameTag({
  player,
  side,
  isCurrent,
  compact,
  wind,
}: {
  player: Player;
  side: "left" | "right";
  isCurrent: boolean;
  compact: boolean;
  wind?: Wind;
}) {
  return (
    <div
      className={`pointer-events-none fixed top-1/2 z-10 -translate-y-1/2 ${
        side === "left" ? "left-0" : "right-0"
      } ${compact ? "px-1" : "px-2"}`}
    >
      <div
        className={`surface-panel flex flex-col gap-0.5 rounded-xl ${
          compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
        } ${isCurrent ? "ring-1 ring-inset ring-gold/40" : ""}`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isCurrent ? "bg-gold" : "bg-slate-500"}`} />
          {player.isLiangDao ? <BadgeCheck className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-gold`} /> : null}
          <span className={`max-w-[72px] truncate font-semibold ${isCurrent ? "text-gold-soft" : "text-bone"}`}>
            {player.name}
          </span>
          <span className={`font-semibold tabular-nums ${scoreClass(player.score)}`}>
            {player.score > 0 ? `+${player.score}` : player.score}
          </span>
        </div>
        {wind ? <span className="text-[10px] font-medium text-gold-soft/80">{WIND_LABEL[wind]}风</span> : null}
      </div>
    </div>
  );
}

// 把一条日志拆成「玩家 + 事件正文」，无玩家前缀的视为系统事件
function parseLog(log: string): { player: (typeof PLAYER_TONES)[number] | null; body: string } {
  const player = PLAYER_TONES.find((tone) => log.startsWith(tone.name));
  if (!player) return { player: null, body: log };
  return { player, body: log.slice(player.name.length).trim() };
}

// 根据事件关键字给正文上色，区分不同动作
function eventToneClass(body: string): string {
  if (/胡|自摸|杠上开花/.test(body)) return "text-yellow-200 font-semibold";
  if (/杠/.test(body)) return "text-fuchsia-200";
  if (/碰/.test(body)) return "text-violet-200";
  if (/亮倒/.test(body)) return "text-sky-200";
  if (/流局/.test(body)) return "text-rose-200";
  if (/打出/.test(body)) return "text-slate-100";
  return "text-slate-300";
}

function scoreClass(score: number): string {
  if (score > 0) return "text-emerald-200";
  if (score < 0) return "text-rose-300";
  return "text-slate-300";
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const baseScore = useGameStore((state) => state.baseScore);
  const nextBaseScore = useGameStore((state) => state.nextBaseScore);
  const liangDaoZimoBuyHorseEnabled = useGameStore((state) => state.liangDaoZimoBuyHorseEnabled);
  const saveNextRoundSettings = useGameStore((state) => state.saveNextRoundSettings);
  const [draftBaseScore, setDraftBaseScore] = useState(String(nextBaseScore));
  const [draftBuyHorseEnabled, setDraftBuyHorseEnabled] = useState(liangDaoZimoBuyHorseEnabled);

  useEffect(() => {
    setDraftBaseScore(String(nextBaseScore));
    setDraftBuyHorseEnabled(liangDaoZimoBuyHorseEnabled);
  }, [nextBaseScore, liangDaoZimoBuyHorseEnabled]);

  function saveSettings() {
    const parsedBaseScore = Number.parseInt(draftBaseScore, 10);
    saveNextRoundSettings({
      baseScore: Number.isFinite(parsedBaseScore) ? parsedBaseScore : nextBaseScore,
      liangDaoZimoBuyHorseEnabled: draftBuyHorseEnabled,
    });
    onClose();
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="surface-modal w-full max-w-sm rounded-2xl p-5 text-sm text-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-base font-semibold text-bone">
            <Settings className="h-4 w-4 text-jade" />
            设置
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-white/5 text-slate-200 transition hover:border-rose-300/40 hover:bg-rose-400/15 hover:text-rose-200"
            aria-label="关闭设置"
            title="关闭设置"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>本局底分</span>
              <span className="font-semibold tabular-nums text-gold-soft">{baseScore}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>本局买马</span>
              <span className={liangDaoZimoBuyHorseEnabled ? "font-semibold text-jade" : "text-slate-500"}>
                {liangDaoZimoBuyHorseEnabled ? "开启" : "关闭"}
              </span>
            </div>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-slate-300">下局底分</span>
            <input
              type="number"
              min={1}
              step={1}
              value={draftBaseScore}
              onChange={(event) => setDraftBaseScore(event.target.value)}
              className="h-10 rounded-lg border border-white/12 bg-slate-900/70 px-3 text-sm font-semibold text-white outline-none transition focus:border-jade/60 focus:ring-1 focus:ring-jade/30"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/12 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-200 transition hover:border-white/20">
            <span>本局亮倒自摸买马</span>
            <input
              type="checkbox"
              checked={draftBuyHorseEnabled}
              onChange={(event) => setDraftBuyHorseEnabled(event.target.checked)}
              className="h-4 w-4 accent-jade"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-white/12 bg-white/5 px-4 text-xs font-semibold text-slate-200 transition hover:bg-white/12"
          >
            取消
          </button>
          <button
            type="button"
            onClick={saveSettings}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-b from-jade-soft to-jade-deep px-4 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(15,155,117,0.4)] transition hover:brightness-110"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameHUD() {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const wall = useGameStore((state) => state.wall);
  const players = useGameStore((state) => state.players);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const phase = useGameStore((state) => state.phase);
  const logs = useGameStore((state) => state.logs);
  const resetRound = useGameStore((state) => state.resetRound);
  const netRole = useGameStore((state) => state.netRole);
  const netWinds = useGameStore((state) => state.netWinds);
  const leaveRoom = useRoomStore((state) => state.leave);
  const backToHome = useRoomStore((state) => state.backToHome);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const logPanelRef = useRef<HTMLDivElement>(null);

  function handleExit() {
    if (netRole === "single") backToHome();
    else void leaveRoom();
  }

  const human = players.human;
  const drawn = human.hand.find((tile) => tile.id === human.lastDrawnTileId);
  const canSelfHu = phase === "playing" && currentPlayerId === "human" && analyzeWin(human.hand, drawn?.kind, human.melds).isWin;
  const tingOptions = getTingDiscardOptions(human.hand, human.melds);
  const anGangKinds = getAnGangKinds(human.hand);
  const buGangMelds = human.melds.filter(
    (meld) => meld.type === "peng" && human.hand.some((tile) => tile.kind === meld.tiles[0].kind),
  );

  useEffect(() => {
    const panel = logPanelRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [logs]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col justify-between ${
        isMobileLandscape
          ? "mobile-landscape-hud"
          : "p-3 sm:p-5"
      }`}
    >
      {netRole !== "single" ? (
        <>
          <SideNameTag player={players.ai_left} side="left" isCurrent={currentPlayerId === "ai_left"} compact={isMobileLandscape} wind={netWinds?.ai_left} />
          <SideNameTag player={players.ai_right} side="right" isCurrent={currentPlayerId === "ai_right"} compact={isMobileLandscape} wind={netWinds?.ai_right} />
        </>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div
          className={`surface-panel pointer-events-auto flex items-center rounded-xl ${
            isMobileLandscape ? "gap-1 px-2 py-1" : "gap-2.5 px-3.5 py-2"
          }`}
        >
          <div className={`flex items-center font-semibold text-bone ${isMobileLandscape ? "gap-1 text-[10px]" : "gap-2 text-sm"}`}>
            <CircleDot className={`${isMobileLandscape ? "h-3 w-3" : "h-4 w-4"} text-jade`} />
            牌墙剩余 <span className="tabular-nums text-gold-soft">{wall.length}</span> 张
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className={`inline-flex items-center justify-center rounded-lg border border-white/12 bg-white/5 text-slate-200 transition hover:border-gold/40 hover:bg-white/12 hover:text-gold-soft ${
              isMobileLandscape ? "h-5 w-5" : "h-7 w-7"
            }`}
            aria-label="设置"
            title="设置"
          >
            <Settings className={isMobileLandscape ? "h-3 w-3" : "h-4 w-4"} />
          </button>
          <button
            type="button"
            onClick={() => setConfirmExit(true)}
            className={`inline-flex items-center justify-center rounded-lg border border-white/12 bg-white/5 text-slate-200 transition hover:border-rose-300/40 hover:bg-rose-400/15 hover:text-rose-200 ${
              isMobileLandscape ? "h-5 w-5" : "h-7 w-7"
            }`}
            aria-label="退出到主页"
            title="退出到主页"
          >
            <LogOut className={isMobileLandscape ? "h-3 w-3" : "h-4 w-4"} />
          </button>
        </div>

        <div className={`pointer-events-auto grid gap-2 ${isMobileLandscape ? "min-w-[118px]" : "min-w-[168px]"}`}>
          <div
            className={`surface-panel grid rounded-xl ${
              isMobileLandscape ? "gap-0.5 px-1.5 py-1.5 text-[10px]" : "gap-1 px-3 py-2.5 text-xs"
            }`}
          >
            {Object.values(players).map((player) => {
              const tone = playerTone(player.name);
              const isCurrent = player.id === currentPlayerId;
              const wind = netRole !== "single" ? netWinds?.[player.id as EngineSeatId] : undefined;
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between rounded-lg px-1.5 py-1 transition ${
                    isMobileLandscape ? "gap-1.5" : "gap-3"
                  } ${isCurrent ? "bg-gold/12 ring-1 ring-inset ring-gold/30" : ""}`}
                >
                  <span className={`flex items-center gap-1.5 ${isCurrent ? "text-bone" : "text-slate-200"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tone?.dot ?? "bg-slate-400"}`} />
                    {player.isLiangDao ? <BadgeCheck className={`${isMobileLandscape ? "h-3 w-3" : "h-3.5 w-3.5"} text-gold`} /> : null}
                    {player.name}
                    {wind ? <span className="text-gold-soft/70">·{WIND_LABEL[wind]}</span> : null}
                  </span>
                  <span className={`font-semibold tabular-nums ${scoreClass(player.score)}`}>
                    {player.score > 0 ? `+${player.score}` : player.score}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={resetRound}
            className={`surface-panel inline-flex items-center justify-center gap-1.5 rounded-xl px-3 font-semibold text-slate-100 transition hover:border-gold/40 hover:text-gold-soft ${
              isMobileLandscape ? "h-6 text-[10px]" : "h-9 text-xs"
            }`}
          >
            <RotateCcw className={isMobileLandscape ? "h-3 w-3" : "h-4 w-4"} />
            新局
          </button>
        </div>
      </div>

      <div
        ref={logPanelRef}
        className={`surface-panel pointer-events-auto fixed left-1/2 z-10 -translate-x-1/2 overflow-auto rounded-xl hud-scrollbar ${
          isMobileLandscape
            ? "mobile-landscape-log max-h-[3.9rem] w-[min(232px,30vw)] space-y-0 p-1 text-[10px]"
            : "top-16 max-h-32 w-[calc(100vw-1.5rem)] space-y-1 p-2 text-xs sm:top-3 sm:w-[min(460px,46vw)]"
        }`}
      >
        {logs.map((log, index) => {
          const { player, body } = parseLog(log);
          const isLatest = index === logs.length - 1;
          return (
            <div
              key={`${log}-${index}`}
              className={`flex items-center rounded ${
                isMobileLandscape ? "gap-1 px-1 leading-4 py-0" : "gap-2 px-1.5 leading-5 py-1"
              } ${isLatest ? "bg-white/8" : ""}`}
            >
              {player ? (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 font-semibold ${
                    isMobileLandscape
                      ? `text-[9px] ${player.text}`
                      : `rounded-full border px-1.5 py-0.5 text-[11px] ${player.chip}`
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${player.dot}`} />
                  {player.name}
                </span>
              ) : (
                <span
                  className={`inline-flex shrink-0 items-center font-medium text-slate-300 ${
                    isMobileLandscape
                      ? "text-[9px]"
                      : "rounded-full border border-white/15 bg-white/8 px-1.5 py-0.5 text-[11px]"
                  }`}
                >
                  系统
                </span>
              )}
              <span className={eventToneClass(body)}>{body}</span>
            </div>
          );
        })}
      </div>

      <ActionPanel canSelfHu={canSelfHu} anGangKinds={anGangKinds} buGangMelds={buGangMelds} tingOptions={tingOptions} />
      {settingsOpen ? <SettingsModal onClose={() => setSettingsOpen(false)} /> : null}
      {confirmExit ? (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="surface-modal w-full max-w-xs rounded-2xl p-5 text-sm text-slate-100">
            <div className="text-base font-semibold text-bone">退出到主页</div>
            <div className="mt-2 text-xs text-slate-400">
              {netRole === "single"
                ? "确定要结束当前对局返回主页吗？"
                : "确定要离开房间返回主页吗？" + (netRole === "host" ? "你是房主，离开将解散整个房间。" : "")}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-white/12 bg-white/5 px-4 text-xs font-semibold text-slate-200 transition hover:bg-white/12"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleExit}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-b from-rose-400 to-rose-600 px-4 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(244,63,94,0.4)] transition hover:brightness-110"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
