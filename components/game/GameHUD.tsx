"use client";

import { useEffect, useRef } from "react";
import { BadgeCheck, CircleDot, RotateCcw } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { analyzeWin, getAnGangKinds, getTingDiscardOptions } from "@/utils/mahjong/handAnalyzer";
import { ActionPanel } from "./ActionPanel";

// 每位玩家一套配色，让信息栏中不同玩家一眼可辨
const PLAYER_TONES: Array<{ name: string; chip: string; dot: string }> = [
  { name: "你", chip: "border-emerald-300/35 bg-emerald-400/15 text-emerald-100", dot: "bg-emerald-400" },
  { name: "左家 AI", chip: "border-sky-300/35 bg-sky-400/15 text-sky-100", dot: "bg-sky-400" },
  { name: "右家 AI", chip: "border-amber-300/35 bg-amber-400/15 text-amber-100", dot: "bg-amber-400" },
];

function playerTone(name: string) {
  return PLAYER_TONES.find((tone) => tone.name === name);
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

export function GameHUD() {
  const wall = useGameStore((state) => state.wall);
  const players = useGameStore((state) => state.players);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const phase = useGameStore((state) => state.phase);
  const logs = useGameStore((state) => state.logs);
  const resetRound = useGameStore((state) => state.resetRound);
  const nextLiangDaoZimoBuyHorseEnabled = useGameStore((state) => state.nextLiangDaoZimoBuyHorseEnabled);
  const setNextLiangDaoZimoBuyHorseEnabled = useGameStore((state) => state.setNextLiangDaoZimoBuyHorseEnabled);
  const logPanelRef = useRef<HTMLDivElement>(null);

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
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2 shadow-panel backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <CircleDot className="h-4 w-4 text-emerald-300" />
            牌墙剩余 {wall.length} 张
          </div>
        </div>

        <div className="pointer-events-auto grid min-w-[168px] gap-2">
          <div className="grid gap-1 rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2 text-xs shadow-panel backdrop-blur-md">
            {Object.values(players).map((player) => {
              const tone = playerTone(player.name);
              const isCurrent = player.id === currentPlayerId;
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between gap-3 rounded px-1.5 py-0.5 ${isCurrent ? "bg-white/8" : ""}`}
                >
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <span className={`h-1.5 w-1.5 rounded-full ${tone?.dot ?? "bg-slate-400"}`} />
                    {player.isLiangDao ? <BadgeCheck className="h-3.5 w-3.5 text-yellow-300" /> : null}
                    {player.name}
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
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-slate-950/70 px-3 text-xs font-semibold text-slate-100 shadow-panel backdrop-blur-md transition hover:bg-white/12"
          >
            <RotateCcw className="h-4 w-4" />
            新局
          </button>
          <label className="pointer-events-auto flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 shadow-panel backdrop-blur-md">
            <span>下局亮倒自摸买马</span>
            <input
              type="checkbox"
              checked={nextLiangDaoZimoBuyHorseEnabled}
              onChange={(event) => setNextLiangDaoZimoBuyHorseEnabled(event.target.checked)}
              className="h-4 w-4 accent-emerald-300"
            />
          </label>
        </div>
      </div>

      <div
        ref={logPanelRef}
        className="pointer-events-auto fixed left-1/2 top-16 z-10 max-h-32 w-[calc(100vw-1.5rem)] -translate-x-1/2 space-y-1 overflow-auto rounded-lg border border-white/10 bg-slate-950/65 p-2 text-xs shadow-panel backdrop-blur-md hud-scrollbar sm:top-3 sm:w-[min(460px,46vw)]"
      >
        {logs.map((log, index) => {
          const { player, body } = parseLog(log);
          const isLatest = index === logs.length - 1;
          return (
            <div
              key={`${log}-${index}`}
              className={`flex items-center gap-2 rounded px-1.5 py-1 leading-5 ${isLatest ? "bg-white/8" : ""}`}
            >
              {player ? (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold ${player.chip}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${player.dot}`} />
                  {player.name}
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/8 px-1.5 py-0.5 text-[11px] font-medium text-slate-300">
                  系统
                </span>
              )}
              <span className={eventToneClass(body)}>{body}</span>
            </div>
          );
        })}
      </div>

      <ActionPanel canSelfHu={canSelfHu} anGangKinds={anGangKinds} buGangMelds={buGangMelds} tingOptions={tingOptions} />
    </div>
  );
}
