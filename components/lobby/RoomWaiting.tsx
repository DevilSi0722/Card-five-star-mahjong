"use client";

import { Crown, Bot, User, LogOut, Copy, Check, Plus } from "lucide-react";
import { useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { formatRoomRoundLimit, WIND_DISPLAY_ORDER, WIND_LABEL, type RoomPlayer, type Wind } from "@/types/multiplayer";
import { formatWinMultiplierLimit } from "@/utils/mahjong/winMultiplierLimit";

function WindSeat({
  wind,
  player,
  isMe,
  canTake,
  onTake,
  compact = false,
}: {
  wind: Wind;
  player?: RoomPlayer;
  isMe: boolean;
  canTake: boolean;
  onTake: () => void;
  compact?: boolean;
}) {
  const interactive = !player && canTake;
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onTake}
      className={`flex flex-1 flex-col items-center rounded-xl border px-1 transition ${
        compact ? "gap-1 py-2" : "gap-1.5 py-3"
      } ${
        player
          ? isMe
            ? "border-gold/50 bg-gold/12"
            : "border-white/10 bg-white/5"
          : interactive
            ? "cursor-pointer border-dashed border-white/15 bg-transparent hover:border-jade/50 hover:bg-white/5"
            : "border-dashed border-white/10 bg-transparent"
      } ${interactive ? "pointer-events-auto" : ""}`}
    >
      <span className={`text-lg font-bold ${player ? "text-gold-soft" : "text-slate-500"}`}>
        {WIND_LABEL[wind]}
      </span>
      <span
        className={`grid h-8 w-8 place-items-center rounded-lg ${
          player?.isAi ? "bg-sky-400/15" : player ? "bg-jade/15" : "bg-white/5"
        }`}
      >
        {player?.isAi ? (
          <Bot className="h-4 w-4 text-sky-300" />
        ) : player ? (
          <User className="h-4 w-4 text-jade" />
        ) : interactive ? (
          <Plus className="h-4 w-4 text-slate-500" />
        ) : (
          <User className="h-4 w-4 text-slate-600" />
        )}
      </span>
      <span className="flex items-center gap-1 text-center text-[11px] font-semibold text-bone">
        {player ? (
          <>
            <span className="max-w-[56px] truncate">{player.name}</span>
            {player.isHost ? <Crown className="h-3 w-3 shrink-0 text-gold" /> : null}
          </>
        ) : (
          <span className="text-slate-500">{interactive ? "点击入座" : "空位"}</span>
        )}
      </span>
    </button>
  );
}

export function RoomWaiting() {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const room = useRoomStore((s) => s.room);
  const isHost = useRoomStore((s) => s.isHost());
  const myWind = useRoomStore((s) => s.myWind);
  const chooseWind = useRoomStore((s) => s.chooseWind);
  const startGame = useRoomStore((s) => s.startGame);
  const leave = useRoomStore((s) => s.leave);
  const busy = useRoomStore((s) => s.busy);
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const humans = room.players.filter((p) => !p.isAi);
  const canStart = isHost && humans.length >= 2;
  const playerAt = (wind: Wind) => room.players.find((p) => p.wind === wind);

  function copyCode() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(room!.code).catch(() => undefined);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <main className={`relative flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-[#071014] ${isMobileLandscape ? "p-2" : "p-4"}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(233,196,106,0.08),transparent_60%)]" />
      <div className={`surface-modal relative w-full overflow-y-auto rounded-2xl hud-scrollbar ${
        isMobileLandscape ? "max-h-[calc(100dvh-1rem)] max-w-[min(440px,calc(100vw-1rem))] p-4" : "max-w-md p-6"
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">房间号</div>
            <button
              type="button"
              onClick={copyCode}
              className={`flex items-center gap-2 font-bold tracking-[0.3em] text-gold-soft transition hover:text-gold ${
                isMobileLandscape ? "text-2xl" : "text-3xl"
              }`}
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

        {/* 横屏：左右双栏（左=风位选择，右=设置摘要+开始），用宽度换高度；竖屏：单列堆叠 */}
        <div className={isMobileLandscape ? "mt-3 grid grid-cols-[1.4fr_1fr] items-start gap-3" : "contents"}>
          <div className={isMobileLandscape ? "" : "mt-5"}>
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>选择风位（{room.players.length}/3）</span>
              <span className="text-slate-500">点击空位可切换</span>
            </div>
            <div className="mt-2 flex gap-2">
              {WIND_DISPLAY_ORDER.map((wind) => (
                <WindSeat
                  key={wind}
                  wind={wind}
                  player={playerAt(wind)}
                  isMe={myWind === wind}
                  canTake={room.players.length < 4}
                  onTake={() => void chooseWind(wind)}
                  compact={isMobileLandscape}
                />
              ))}
            </div>
          </div>

          <div className={isMobileLandscape ? "grid content-start gap-3" : "contents"}>
            {/* 设置摘要 */}
            <div className={`grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-white/5 text-center ${isMobileLandscape ? "p-2" : "mt-4 p-3 sm:grid-cols-4"}`}>
              <div>
                <div className="text-[11px] text-slate-400">局数</div>
                <div className="text-sm font-semibold text-bone">{formatRoomRoundLimit(room.settings.rounds, isMobileLandscape)}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">底分</div>
                <div className="text-sm font-semibold text-bone">{room.settings.baseScore}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">封顶</div>
                <div className="text-sm font-semibold text-gold-soft">
                  {formatWinMultiplierLimit(room.settings.maxWinMultiplier === undefined ? 8 : room.settings.maxWinMultiplier)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">买马</div>
                <div className={`text-sm font-semibold ${room.settings.liangDaoZimoBuyHorse ? "text-jade" : "text-slate-500"}`}>
                  {room.settings.liangDaoZimoBuyHorse ? "开" : "关"}
                </div>
              </div>
            </div>

            {isHost ? (
              <div className={`grid gap-2 ${isMobileLandscape ? "" : "mt-4"}`}>
                <button
                  type="button"
                  disabled={!canStart || busy}
                  onClick={startGame}
                  className={`surface-panel inline-flex items-center justify-center rounded-xl border-gold/40 font-semibold transition hover:border-gold/70 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${
                    isMobileLandscape ? "h-10" : "h-11"
                  }`}
                >
                  <span className="bg-gradient-to-b from-[#f7e6b8] via-gold to-gold-deep bg-clip-text text-transparent">
                    {busy ? "开始中…" : "开始游戏"}
                  </span>
                </button>
                <div className="text-center text-[11px] text-slate-500">
                  {canStart ? "不足三人时空缺风位将自动补电脑" : "至少需要 2 名真人玩家才能开始"}
                </div>
              </div>
            ) : (
              <div className={`rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-center text-xs text-slate-400 ${isMobileLandscape ? "" : "mt-4"}`}>
                等待房主开始游戏…
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
