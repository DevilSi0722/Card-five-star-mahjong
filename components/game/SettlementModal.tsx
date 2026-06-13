"use client";

import { Check, LogOut, RotateCcw, Trophy } from "lucide-react";
import type { PlayerId, ScoreResult } from "@/types/mahjong";
import { useGameStore } from "@/store/gameStore";
import { useRoomStore } from "@/store/roomStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { TILE_KIND_LABEL } from "@/utils/mahjong/tiles";

const METHOD_LABEL: Record<NonNullable<ScoreResult["method"]>, string> = {
  zimo: "自摸",
  discard: "点炮",
  qianggang: "抢杠胡",
  gangshang: "杠上开花",
};

// 用自然语句描述某位玩家如何赢牌，例如「左家给你点炮」「你自摸」。name 解析适应各自视角。
function describeWin(
  detail: { winnerId: PlayerId; loserId?: PlayerId; method: NonNullable<ScoreResult["method"]> },
  nameOf: (id: PlayerId) => string,
): string {
  const winner = nameOf(detail.winnerId);
  const loser = detail.loserId ? nameOf(detail.loserId) : undefined;
  switch (detail.method) {
    case "zimo":
      return `${winner}自摸`;
    case "gangshang":
      return `${winner}杠上开花`;
    case "qianggang":
      return loser ? `${winner}抢${loser}的杠胡` : `${winner}抢杠胡`;
    case "discard":
      return loser ? `${loser}给${winner}点炮` : `${winner}胡牌`;
    default:
      return winner;
  }
}

export function SettlementModal({ result }: { result: ScoreResult }) {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const resetRound = useGameStore((state) => state.resetRound);
  const players = useGameStore((state) => state.players);
  const netRole = useGameStore((state) => state.netRole);
  const room = useRoomStore((state) => state.room);
  const myClientId = useRoomStore((state) => state.clientId);
  const markReady = useRoomStore((state) => state.markReady);
  const leaveRoom = useRoomStore((state) => state.leave);

  // 玩家名解析：自己（底部 human）显示「你」，其余用引擎中的真实昵称（已按视角旋转）。
  const nameOf = (id: PlayerId): string => (id === "human" ? "你" : players[id]?.name ?? id);

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

  const isDraw = !result.winnerId;
  const hasMultipleWinners = winDetails.length > 1;
  const winnerNames = winDetails.map((detail) => nameOf(detail.winnerId)).join("、");
  const winDescription = winDetails.map((detail) => describeWin(detail, nameOf)).join("，");

  // 多人模式准备状态。
  const isMultiplayer = netRole !== "single";
  const humans = room ? room.players.filter((p) => !p.isAi) : [];
  const readySet = new Set(room?.readyClients ?? []);
  const iAmReady = readySet.has(myClientId);
  const readyCount = humans.filter((p) => readySet.has(p.clientId)).length;
  // 是否已是设定局数的最后一局：最后一局结束后不再提供「准备」，只能退出。
  const isLastRound = Boolean(room && room.currentRound >= room.settings.rounds);

  return (
    <div className={`absolute inset-0 z-30 flex items-center justify-center bg-black/45 backdrop-blur-sm ${isMobileLandscape ? "p-2" : "p-4"}`}>
      <div
        className={`surface-modal w-full overflow-y-auto rounded-2xl hud-scrollbar ${
          isMobileLandscape ? "max-h-[calc(100dvh-1rem)] max-w-[min(660px,calc(100vw-1rem))] p-3" : "max-w-md p-5"
        }`}
      >
        {/* 标题：赢家是谁，副标题描述怎么赢的 */}
        <div className="flex items-center gap-2.5">
          <span className={`grid shrink-0 place-items-center rounded-full bg-gold/15 ${isMobileLandscape ? "h-8 w-8" : "h-10 w-10"}`}>
            <Trophy className={`${isMobileLandscape ? "h-4 w-4" : "h-5 w-5"} text-gold`} />
          </span>
          <div className="min-w-0">
            <div className={`brand-title font-semibold leading-tight ${isMobileLandscape ? "text-base" : "text-xl"}`}>
              {isDraw ? "流局" : `赢家：${winnerNames}`}
            </div>
            <div className={`mt-0.5 text-slate-400 ${isMobileLandscape ? "text-[11px]" : "text-xs"}`}>
              {isDraw ? "牌墙摸空 · 本局不计分" : winDescription}
            </div>
          </div>
        </div>

        {/* 横屏且有番型：番型明细 + 比分表并排成双栏，用宽度换高度；流局无番型或竖屏：上下堆叠 */}
        <div className={isMobileLandscape && winDetails.length > 0 ? "mt-2 grid grid-cols-2 items-start gap-2" : "contents"}>
          {/* 番型明细 */}
          {winDetails.length > 0 ? (
            <div className={`${isMobileLandscape ? "p-2" : "mt-4 p-3"} rounded-xl border border-white/8 bg-white/5`}>
              <div className={`font-medium text-gold-soft ${isMobileLandscape ? "text-[11px]" : "text-xs"}`}>番型</div>
              <div className={`divide-y divide-white/8 ${isMobileLandscape ? "mt-1" : "mt-1.5"}`}>
                {winDetails.map((detail) => (
                  <div key={detail.winnerId} className={isMobileLandscape ? "py-1.5 first:pt-0 last:pb-0" : "py-2.5 first:pt-0 last:pb-0"}>
                    {hasMultipleWinners ? (
                      <div className="mb-1 text-xs font-medium text-slate-200">
                        {nameOf(detail.winnerId)} · {METHOD_LABEL[detail.method]}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                      {detail.fans.map((fan) => (
                        <span
                          key={fan.type}
                          className={`rounded-md border border-jade/30 bg-jade/12 font-medium text-jade-soft ${
                            isMobileLandscape ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"
                          }`}
                        >
                          {fan.name} ×{fan.fan}
                        </span>
                      ))}
                    </div>
                    <div className={`flex items-center gap-2 text-slate-400 ${isMobileLandscape ? "mt-1 text-[11px]" : "mt-1.5 text-xs"}`}>
                      <span>
                        倍率 <span className="font-semibold text-gold-soft">×{detail.multiplier}</span>
                      </span>
                      <span className="text-white/15">|</span>
                      <span>
                        每家 <span className="font-semibold text-slate-200">{detail.baseScore}</span> 分
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {result.buyHorse ? (
                <div className={`flex items-center justify-between rounded-md border border-sky-300/25 bg-sky-400/10 text-sky-100 ${isMobileLandscape ? "mt-1.5 px-2 py-1 text-[11px]" : "mt-2.5 px-2.5 py-1.5 text-sm"}`}>
                  <span>买马 · {TILE_KIND_LABEL[result.buyHorse.tile.kind]}（{result.buyHorse.value} 点）</span>
                  <span className="font-semibold text-jade-soft">+{result.buyHorse.bonus}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 比分结算：带表头，本局变化 + 累计总分 */}
          <div className={`overflow-hidden rounded-xl border border-white/10 ${isMobileLandscape ? (winDetails.length > 0 ? "" : "mt-2") : "mt-4"}`}>
            <div className={`grid grid-cols-3 border-b border-white/10 bg-white/[0.04] font-medium text-slate-400 ${isMobileLandscape ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"}`}>
              <span>玩家</span>
              <span className="text-center">本局</span>
              <span className="text-right">总分</span>
            </div>
            {ids.map((id) => {
              const change = result.scoreChanges[id];
              const isHuman = id === "human";
              return (
                <div
                  key={id}
                  className={`grid grid-cols-3 items-center border-b border-white/8 last:border-b-0 ${isHuman ? "bg-gold/10" : ""} ${isMobileLandscape ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
                >
                  <span className={isHuman ? "font-semibold text-bone" : "text-slate-200"}>{nameOf(id)}</span>
                  <span className={`text-center font-semibold tabular-nums ${change > 0 ? "text-jade-soft" : change < 0 ? "text-rose-300" : "text-slate-400"}`}>
                    {change > 0 ? `+${change}` : change}
                  </span>
                  <span className="text-right tabular-nums text-slate-300">{result.totalScores[id]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {isMultiplayer ? (
          isLastRound ? (
            <div className={isMobileLandscape ? "mt-2" : "mt-5"}>
              <div className={`text-center text-gold-soft ${isMobileLandscape ? "mb-1.5 text-[11px]" : "mb-2.5 text-xs"}`}>
                已打满 {room?.settings.rounds} 局，本局为最后一局
              </div>
              <button
                type="button"
                onClick={() => void leaveRoom()}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 font-semibold text-slate-200 transition hover:border-rose-300/40 hover:bg-rose-400/15 hover:text-rose-200 ${
                  isMobileLandscape ? "h-8 text-xs" : "h-10 text-sm"
                }`}
              >
                <LogOut className={isMobileLandscape ? "h-3.5 w-3.5" : "h-4 w-4"} />
                退出
              </button>
            </div>
          ) : (
            <div className={`grid grid-cols-2 gap-2 ${isMobileLandscape ? "mt-2" : "mt-5"}`}>
              <button
                type="button"
                disabled={iAmReady}
                onClick={() => void markReady()}
                className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition ${
                  iAmReady
                    ? "border border-jade/40 bg-jade/15 text-jade-soft"
                    : "bg-gradient-to-b from-jade-soft to-jade-deep text-white shadow-[0_8px_22px_rgba(15,155,117,0.4)] hover:brightness-110"
                } ${isMobileLandscape ? "h-8 text-xs" : "h-10 text-sm"}`}
              >
                {iAmReady ? (
                  <>
                    <Check className={isMobileLandscape ? "h-3.5 w-3.5" : "h-4 w-4"} />
                    已准备 {readyCount}/{humans.length}
                  </>
                ) : (
                  <>
                    <RotateCcw className={isMobileLandscape ? "h-3.5 w-3.5" : "h-4 w-4"} />
                    准备
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => void leaveRoom()}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 font-semibold text-slate-200 transition hover:border-rose-300/40 hover:bg-rose-400/15 hover:text-rose-200 ${
                  isMobileLandscape ? "h-8 text-xs" : "h-10 text-sm"
                }`}
              >
                <LogOut className={isMobileLandscape ? "h-3.5 w-3.5" : "h-4 w-4"} />
                退出
              </button>
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={resetRound}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-jade-soft to-jade-deep font-semibold text-white shadow-[0_8px_22px_rgba(15,155,117,0.4)] transition hover:brightness-110 ${
              isMobileLandscape ? "mt-2 h-8 text-xs" : "mt-5 h-10 text-sm"
            }`}
          >
            <RotateCcw className={isMobileLandscape ? "h-3.5 w-3.5" : "h-4 w-4"} />
            新局
          </button>
        )}
        {isMultiplayer && iAmReady && !isLastRound ? (
          <div className={`text-center text-slate-500 ${isMobileLandscape ? "mt-1 text-[10px]" : "mt-2 text-[11px]"}`}>
            等待其他玩家准备，全部就绪后自动开始下一局
          </div>
        ) : null}
      </div>
    </div>
  );
}
