"use client";

import { RotateCcw, Trophy } from "lucide-react";
import type { PlayerId, ScoreResult } from "@/types/mahjong";
import { useGameStore } from "@/store/gameStore";
import { TILE_KIND_LABEL } from "@/utils/mahjong/tiles";

const PLAYER_LABEL: Record<PlayerId, string> = {
  human: "你",
  ai_left: "左家 AI",
  ai_right: "右家 AI",
};

const METHOD_LABEL: Record<NonNullable<ScoreResult["method"]>, string> = {
  zimo: "自摸",
  discard: "点炮",
  qianggang: "抢杠胡",
  gangshang: "杠上开花",
};

export function SettlementModal({ result }: { result: ScoreResult }) {
  const resetRound = useGameStore((state) => state.resetRound);
  const ids = Object.keys(result.scoreChanges) as PlayerId[];
  const winDetails =
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
      : []);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-lg border border-white/12 bg-slate-950/95 p-5 shadow-panel">
        <div className="flex items-center gap-2 text-lg font-semibold text-white">
          <Trophy className="h-5 w-5 text-yellow-300" />
          {result.title}
        </div>
        {result.winnerId ? (
          <div className="mt-2 text-sm text-slate-300">
            胡牌玩家：{winDetails.map((detail) => PLAYER_LABEL[detail.winnerId]).join("、")}，方式：
            {result.method ? METHOD_LABEL[result.method] : ""}
          </div>
        ) : (
          <div className="mt-2 text-sm text-slate-300">牌墙摸空，本局不计分。</div>
        )}

        <div className="mt-4 rounded-md bg-white/6 p-3">
          <div className="text-sm font-medium text-slate-100">番型</div>
          {winDetails.length > 0 ? (
            <div className="mt-2 space-y-3">
              {winDetails.map((detail) => (
                <div key={detail.winnerId} className="rounded-md border border-white/8 bg-slate-900/60 p-2.5">
                  <div className="text-xs font-medium text-slate-200">
                    {PLAYER_LABEL[detail.winnerId]} · {METHOD_LABEL[detail.method]}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.fans.map((fan) => (
                      <span
                        key={fan.type}
                        className="rounded-md border border-emerald-300/25 bg-emerald-400/12 px-2 py-1 text-xs text-emerald-100"
                      >
                        {fan.name} ×{fan.fan}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-slate-300">
                    总倍率：×{detail.multiplier}，单份分：{detail.baseScore}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-400">无</div>
          )}
          {result.buyHorse ? (
            <div className="mt-2 rounded-md border border-sky-300/20 bg-sky-400/10 px-2 py-1.5 text-sm text-sky-100">
              买马：{TILE_KIND_LABEL[result.buyHorse.tile.kind]}，点数 {result.buyHorse.value}，额外 +{result.buyHorse.bonus}
            </div>
          ) : null}
        </div>

        <div className="mt-4 overflow-hidden rounded-md border border-white/10">
          {ids.map((id) => (
            <div key={id} className="grid grid-cols-3 border-b border-white/8 px-3 py-2 text-sm last:border-b-0">
              <span className="text-slate-200">{PLAYER_LABEL[id]}</span>
              <span className={result.scoreChanges[id] >= 0 ? "text-emerald-200" : "text-rose-200"}>
                {result.scoreChanges[id] >= 0 ? "+" : ""}
                {result.scoreChanges[id]}
              </span>
              <span className="text-right text-slate-300">{result.totalScores[id]}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={resetRound}
          className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
        >
          <RotateCcw className="h-4 w-4" />
          新局
        </button>
      </div>
    </div>
  );
}
