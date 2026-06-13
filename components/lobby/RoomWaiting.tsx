"use client";

import { Crown, Bot, User, LogOut, Plus, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import { SEAT_TURN_ORDER, type EngineSeatId } from "@/types/multiplayer";

const SEAT_LABEL: Record<EngineSeatId, string> = {
  human: "座位一",
  ai_right: "座位二",
  ai_left: "座位三",
};

export function RoomWaiting() {
  const room = useRoomStore((s) => s.room);
  const isHost = useRoomStore((s) => s.isHost());
  const fillWithAi = useRoomStore((s) => s.fillWithAi);
  const startGame = useRoomStore((s) => s.startGame);
  const leave = useRoomStore((s) => s.leave);
  const busy = useRoomStore((s) => s.busy);
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const humans = room.players.filter((p) => !p.isAi);
  const canStart = isHost && humans.length >= 2;
  const seatFilled = (seat: EngineSeatId) => room.players.find((p) => p.seat === seat);
  const hasFreeSeat = room.players.length < 3;

  function copyCode() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(room!.code).catch(() => undefined);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#071014] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(233,196,106,0.08),transparent_60%)]" />
      <div className="surface-modal relative w-full max-w-sm rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">房间号</div>
            <button
              type="button"
              onClick={copyCode}
              className="flex items-center gap-2 text-3xl font-bold tracking-[0.3em] text-gold-soft transition hover:text-gold"
            >
              {room.code}
              {copied ? <Check className="h-4 w-4 text-jade" /> : <Copy className="h-4 w-4 text-slate-500" />}
            </button>
          </div>
          <button
            type="button"
            onClick={leave}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:border-rose-300/40 hover:text-rose-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            {isHost ? "解散" : "离开"}
          </button>
        </div>

        <div className="mt-5 grid gap-2">
          <div className="text-xs font-medium text-slate-400">玩家（{room.players.length}/3）</div>
          {SEAT_TURN_ORDER.map((seat) => {
            const player = seatFilled(seat);
            return (
              <div
                key={seat}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  player ? "border-white/10 bg-white/5" : "border-dashed border-white/10 bg-transparent"
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    player?.isAi ? "bg-sky-400/15" : player ? "bg-jade/15" : "bg-white/5"
                  }`}
                >
                  {player?.isAi ? (
                    <Bot className="h-4 w-4 text-sky-300" />
                  ) : player ? (
                    <User className="h-4 w-4 text-jade" />
                  ) : (
                    <User className="h-4 w-4 text-slate-600" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-bone">
                    {player ? player.name : <span className="text-slate-500">空位</span>}
                    {player?.isHost ? <Crown className="h-3.5 w-3.5 text-gold" /> : null}
                  </span>
                  <span className="text-[11px] text-slate-500">{SEAT_LABEL[seat]}</span>
                </span>
                {player?.isAi ? <span className="text-[11px] text-sky-300/80">电脑</span> : null}
              </div>
            );
          })}
        </div>

        {/* 设置摘要 */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/8 bg-white/5 p-3 text-center">
          <div>
            <div className="text-[11px] text-slate-400">局数</div>
            <div className="text-sm font-semibold text-bone">{room.settings.rounds}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">底分</div>
            <div className="text-sm font-semibold text-bone">{room.settings.baseScore}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">买马</div>
            <div className={`text-sm font-semibold ${room.settings.liangDaoZimoBuyHorse ? "text-jade" : "text-slate-500"}`}>
              {room.settings.liangDaoZimoBuyHorse ? "开" : "关"}
            </div>
          </div>
        </div>

        {isHost ? (
          <div className="mt-4 grid gap-2">
            {hasFreeSeat ? (
              <button
                type="button"
                onClick={fillWithAi}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 text-xs font-semibold text-slate-200 transition hover:border-sky-300/40 hover:text-sky-200"
              >
                <Plus className="h-4 w-4" />
                添加电脑玩家
              </button>
            ) : null}
            <button
              type="button"
              disabled={!canStart || busy}
              onClick={startGame}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-gold-soft to-gold-deep font-semibold text-ink shadow-[0_8px_22px_rgba(233,196,106,0.4)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "开始中…" : "开始游戏"}
            </button>
            {!canStart ? (
              <div className="text-center text-[11px] text-slate-500">至少需要 2 名真人玩家，不足三人将自动补电脑</div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-center text-xs text-slate-400">
            等待房主开始游戏…
          </div>
        )}
      </div>
    </main>
  );
}
