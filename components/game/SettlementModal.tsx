"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, LogOut, RotateCcw, Trophy, X } from "lucide-react";
import frontTileFace from "@/png/optimized/front.webp";
import type { PlayerId, ScoreResult, TileInstance } from "@/types/mahjong";
import { useGameStore } from "@/store/gameStore";
import { useRoomStore } from "@/store/roomStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { formatRoomRoundLimit } from "@/types/multiplayer";
import { TILE_KIND_LABEL, sortTiles } from "@/utils/mahjong/tiles";
import { getTileTextureSrc } from "@/utils/mahjong/tileTextures";

const SETTLEMENT_PLAYER_ORDER: PlayerId[] = ["human", "ai_right", "ai_left"];

function scoreTone(value: number): string {
  if (value > 0) return "text-jade-soft";
  if (value < 0) return "text-rose-300";
  return "text-slate-400";
}

function notePriority(note: string): number {
  if (note.includes("胡") || note.includes("亮倒") || note.includes("清一色") || note.includes("七对") || note.includes("大三元") || note.includes("小三元")) return 0;
  if (note.includes("点炮") || note.includes("自摸") || note.includes("抢杠") || note.includes("杠开")) return 1;
  if (note.includes("杠")) return 2;
  if (note.includes("买马")) return 3;
  return 4;
}

function displayNotes(notes: string[] | undefined): string[] {
  if (!notes || notes.length === 0) return ["无计分"];
  return [...notes].sort((a, b) => notePriority(a) - notePriority(b));
}

function settlementHandTiles(playerId: PlayerId, result: ScoreResult, players: ReturnType<typeof useGameStore.getState>["players"]): TileInstance[] {
  const snapshot = result.winningHands?.find((item) => item.playerId === playerId);
  if (snapshot) return snapshot.tiles;
  const player = players[playerId];
  const meldTiles = player.melds.flatMap((meld) =>
    meld.type === "ming_gang" || meld.type === "an_gang" || meld.type === "bu_gang"
      ? meld.tiles.slice(0, 3)
      : meld.tiles,
  );
  return [...meldTiles, ...sortTiles(player.hand)];
}

function SettlementTile({ tile, compact }: { tile: TileInstance; compact: boolean }) {
  const textureSrc = getTileTextureSrc(tile.kind);
  const label = TILE_KIND_LABEL[tile.kind];
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-[5px] shadow-[0_4px_10px_rgba(0,0,0,0.32)] ${
        compact ? "h-[28px] w-[19px]" : "h-[54px] w-[37px]"
      }`}
      title={label}
      aria-label={label}
    >
      <Image src={frontTileFace} alt="" fill sizes={compact ? "19px" : "37px"} className="object-fill" unoptimized />
      {textureSrc ? (
        <Image
          src={textureSrc}
          alt={label}
          width={compact ? 13 : 26}
          height={compact ? 18 : 36}
          className={`absolute left-1/2 top-[53%] -translate-x-1/2 -translate-y-1/2 object-contain ${
            compact ? "h-[18px] w-[13px]" : "h-[36px] w-[26px]"
          }`}
          unoptimized
        />
      ) : null}
    </span>
  );
}

function SettlementHand({ tiles, compact }: { tiles: TileInstance[]; compact: boolean }) {
  return (
    <div className={`flex max-w-full items-end ${compact ? "gap-px" : "gap-0.5"}`}>
      {tiles.map((tile, index) => (
        <SettlementTile key={`${tile.id}-${index}`} tile={tile} compact={compact} />
      ))}
    </div>
  );
}

export function SettlementModal({ result }: { result: ScoreResult }) {
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const { isMobileLandscape } = useResponsiveGameLayout();
  const resetRound = useGameStore((state) => state.resetRound);
  const players = useGameStore((state) => state.players);
  const roundStartScores = useGameStore((state) => state.roundStartScores);
  const roundScoreNotes = useGameStore((state) => state.roundScoreNotes);
  const netRole = useGameStore((state) => state.netRole);
  const room = useRoomStore((state) => state.room);
  const myClientId = useRoomStore((state) => state.clientId);
  const markReady = useRoomStore((state) => state.markReady);
  const leaveRoom = useRoomStore((state) => state.leave);

  // 玩家名解析：自己（底部 human）显示「你」，其余用引擎中的真实昵称（已按视角旋转）。
  const nameOf = (id: PlayerId): string => (id === "human" ? "你" : players[id]?.name ?? id);

  const ids = SETTLEMENT_PLAYER_ORDER.filter((id) => id in result.scoreChanges);
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
  const winnerNames = winDetails.map((detail) => nameOf(detail.winnerId)).join("、");

  // 多人模式准备状态。
  const isMultiplayer = netRole !== "single";
  const humans = room ? room.players.filter((p) => !p.isAi) : [];
  const readySet = new Set(room?.readyClients ?? []);
  const iAmReady = readySet.has(myClientId);
  const readyCount = humans.filter((p) => readySet.has(p.clientId)).length;
  // 是否已是设定局数的最后一局：无限制房间始终允许继续准备下一局。
  const isLastRound = Boolean(room && room.settings.rounds !== null && room.currentRound >= room.settings.rounds);
  const isHost = Boolean(room && room.hostClientId === myClientId);

  function requestExit() {
    setExitConfirmOpen(true);
  }

  function confirmExit() {
    setExitConfirmOpen(false);
    void leaveRoom();
  }

  return (
    <div className={`settlement-modal-backdrop absolute inset-0 z-30 flex items-center justify-center bg-black/45 ${isMobileLandscape ? "p-2" : "p-4"}`}>
      <div
        className={`settlement-modal-panel surface-modal w-full overflow-y-auto rounded-2xl hud-scrollbar ${
          isMobileLandscape ? "max-h-[calc(100dvh-1rem)] max-w-[min(700px,calc(100vw-1rem))] p-3" : "max-w-5xl p-5"
        }`}
      >
        {/* 标题 */}
        <div className="flex items-center gap-2.5">
          <span className={`grid shrink-0 place-items-center rounded-full bg-gold/15 ${isMobileLandscape ? "h-8 w-8" : "h-10 w-10"}`}>
            <Trophy className={`${isMobileLandscape ? "h-4 w-4" : "h-5 w-5"} text-gold`} />
          </span>
          <div className="min-w-0">
            <div className={`brand-title font-semibold leading-tight ${isMobileLandscape ? "text-base" : "text-xl"}`}>
              {isDraw ? "流局" : `赢家：${winnerNames}`}
            </div>
          </div>
        </div>

        {/* 五列结算表：玩家 / 明细 / 上局 / 本局 / 总分 */}
        <div className={`overflow-x-auto rounded-xl border border-white/10 hud-scrollbar ${isMobileLandscape ? "mt-2" : "mt-4"}`}>
          <div className={`${isMobileLandscape ? "min-w-[620px] text-[11px]" : "min-w-[880px] text-xs"}`}>
            <div className={`grid ${isMobileLandscape ? "grid-cols-[0.75fr_2.6fr_0.75fr_0.75fr_0.75fr]" : "grid-cols-[0.7fr_4.4fr_0.7fr_0.7fr_0.7fr]"} border-b border-white/10 bg-white/[0.04] font-medium text-slate-400 ${
              isMobileLandscape ? "px-2 py-1" : "px-3 py-1.5"
            }`}>
              <span>玩家</span>
              <span>本局番型与杠</span>
              <span className="text-right">上局</span>
              <span className="text-right">本局</span>
              <span className="text-right">总分</span>
            </div>
            {ids.map((id) => {
              const notes = displayNotes(roundScoreNotes[id]);
              const isWinner = winDetails.some((detail) => detail.winnerId === id);
              const winningTiles = isWinner ? settlementHandTiles(id, result, players) : [];
              const previousScore = roundStartScores[id] ?? (result.totalScores[id] - result.scoreChanges[id]);
              const change = result.scoreChanges[id];
              const total = result.totalScores[id];
              const isHuman = id === "human";
              return (
                <div
                  key={id}
                  className={`grid ${isMobileLandscape ? "grid-cols-[0.75fr_2.6fr_0.75fr_0.75fr_0.75fr]" : "grid-cols-[0.7fr_4.4fr_0.7fr_0.7fr_0.7fr]"} items-center border-b border-white/8 last:border-b-0 ${
                    isHuman ? "bg-gold/10" : ""
                  } ${isMobileLandscape ? "px-2 py-1.5" : "px-3 py-2"}`}
                >
                  <span className={`min-w-0 truncate ${isHuman ? "font-semibold text-bone" : "text-slate-200"}`}>{nameOf(id)}</span>
                  <span className={`flex min-w-0 flex-col ${isMobileLandscape ? "gap-1" : "gap-1.5"}`}>
                    {isWinner && winningTiles.length > 0 ? (
                      <SettlementHand tiles={winningTiles} compact={isMobileLandscape} />
                    ) : null}
                    <span className="flex min-w-0 flex-wrap gap-1">
                      {notes.map((note, index) => (
                        <span
                          key={`${id}-${note}-${index}`}
                          className={`rounded-md border px-1.5 py-0.5 font-medium ${
                            note.includes("+")
                              ? "border-jade/30 bg-jade/12 text-jade-soft"
                              : note.includes("-")
                                ? "border-rose-300/25 bg-rose-400/10 text-rose-200"
                                : "border-white/10 bg-white/5 text-slate-400"
                          }`}
                        >
                          {note}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="text-right tabular-nums text-slate-300">{previousScore}</span>
                  <span className={`text-right font-semibold tabular-nums ${scoreTone(change)}`}>
                    {change > 0 ? `+${change}` : change}
                  </span>
                  <span className="text-right tabular-nums text-slate-200">{total}</span>
                </div>
              );
            })}
          </div>
        </div>

        {isMultiplayer ? (
          isLastRound ? (
            <div className={isMobileLandscape ? "mt-2" : "mt-5"}>
              <div className={`text-center text-gold-soft ${isMobileLandscape ? "mb-1.5 text-[11px]" : "mb-2.5 text-xs"}`}>
                已打满 {room ? formatRoomRoundLimit(room.settings.rounds) : ""}，本局为最后一局
              </div>
              <button
                type="button"
                onClick={requestExit}
                className={`mx-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/5 font-semibold text-slate-300 transition hover:border-rose-300/40 hover:bg-rose-400/15 hover:text-rose-200 ${
                  isMobileLandscape ? "h-8 px-4 text-xs" : "h-9 px-5 text-xs"
                }`}
              >
                <LogOut className={isMobileLandscape ? "h-3.5 w-3.5" : "h-4 w-4"} />
                退出
              </button>
            </div>
          ) : (
            <div className={`grid grid-cols-[1fr_auto] gap-2 ${isMobileLandscape ? "mt-2" : "mt-5"}`}>
              <button
                type="button"
                disabled={iAmReady}
                onClick={() => {
                  if (!room) return;
                  void markReady(room.currentRound);
                }}
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
                onClick={requestExit}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/5 font-semibold text-slate-300 transition hover:border-rose-300/40 hover:bg-rose-400/15 hover:text-rose-200 ${
                  isMobileLandscape ? "h-8 px-3 text-xs" : "h-10 px-4 text-xs"
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
      {exitConfirmOpen ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-3">
          <div
            className={`surface-modal w-full rounded-2xl border border-white/12 text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)] ${
              isMobileLandscape ? "max-w-[min(360px,calc(100vw-1rem))] p-3" : "max-w-sm p-5"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`grid shrink-0 place-items-center rounded-full bg-rose-400/12 ${isMobileLandscape ? "h-8 w-8" : "h-9 w-9"}`}>
                  <LogOut className={`${isMobileLandscape ? "h-4 w-4" : "h-5 w-5"} text-rose-200`} />
                </span>
                <div className="min-w-0">
                  <div className={`font-semibold text-bone ${isMobileLandscape ? "text-sm" : "text-base"}`}>
                    确认退出房间？
                  </div>
                  <div className={`mt-1 leading-relaxed text-slate-400 ${isMobileLandscape ? "text-[11px]" : "text-xs"}`}>
                    {isHost
                      ? "你是房主，退出会解散房间，其他玩家无法再重连。"
                      : "退出后会回到主界面，只要房主未解散房间，可以用原设备和房间号重连。"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExitConfirmOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/5 text-slate-300 transition hover:bg-white/12 hover:text-bone"
                aria-label="取消退出"
                title="取消退出"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className={`grid grid-cols-2 gap-2 ${isMobileLandscape ? "mt-3" : "mt-5"}`}>
              <button
                type="button"
                onClick={() => setExitConfirmOpen(false)}
                className={`inline-flex items-center justify-center rounded-lg border border-white/12 bg-white/5 text-xs font-semibold text-slate-200 transition hover:bg-white/12 ${
                  isMobileLandscape ? "h-8" : "h-9"
                }`}
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmExit}
                className={`inline-flex items-center justify-center rounded-lg border border-rose-300/35 bg-rose-400/15 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/25 ${
                  isMobileLandscape ? "h-8" : "h-9"
                }`}
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
