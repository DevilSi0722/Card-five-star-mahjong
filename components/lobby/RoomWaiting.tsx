"use client";

import Image from "next/image";
import { Crown, LogOut, Copy, Check, Plus } from "lucide-react";
import { useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { formatRoomRoundLimit, WIND_DISPLAY_ORDER, WIND_LABEL, type RoomPlayer, type Wind } from "@/types/multiplayer";
import { formatWinMultiplierLimit } from "@/utils/mahjong/winMultiplierLimit";

const WIND_AVATAR_SRC: Record<Wind, string> = {
  east: "/generated/avatars/human-jade-guardian-1k.png",
  south: "/generated/avatars/ai-left-scholar-1k.png",
  west: "/generated/avatars/ai-right-strategist-1k.png",
  north: "/generated/avatars/north-jade-strategist-2k.png",
};

const AI_AVATAR_SRC = "/generated/avatars/ai-right-strategist-1k.png";

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
  const avatarSrc = player?.isAi ? AI_AVATAR_SRC : WIND_AVATAR_SRC[wind];
  const status = player ? (isMe ? "你已入座" : player.isAi ? "电脑补位" : "已入座") : interactive ? "点击入座" : "空位";

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onTake}
      aria-label={`${WIND_LABEL[wind]}风${status}`}
      className={`relative flex min-w-0 flex-1 flex-col items-center rounded-xl border transition ${
        compact ? "min-h-[106px] gap-1.5 px-1.5 py-2" : "min-h-[150px] gap-2.5 px-3 py-3"
      } ${
        player
          ? isMe
            ? "border-gold/65 bg-gold/12 shadow-[0_0_22px_rgba(233,196,106,0.15)]"
            : "border-white/14 bg-slate-950/35"
          : interactive
            ? "cursor-pointer border-dashed border-jade/35 bg-slate-950/20 hover:border-jade/70 hover:bg-jade/10"
            : "border-dashed border-white/10 bg-slate-950/10"
      } ${interactive ? "pointer-events-auto" : ""}`}
    >
      <span className={`absolute left-2 top-1.5 font-serif text-sm font-bold ${player ? "text-gold-soft" : "text-slate-500"}`}>
        {WIND_LABEL[wind]}风
      </span>
      {player ? (
        <>
          <Image
            src={avatarSrc}
            alt=""
            width={1024}
            height={1024}
            className={`${compact ? "mt-4 h-11 w-11" : "mt-5 h-16 w-16"} rounded-full border border-gold/35 object-cover shadow-[0_0_18px_rgba(233,196,106,0.16)]`}
          />
          <span className={`flex min-w-0 items-center gap-1 font-semibold text-bone ${compact ? "text-[11px]" : "text-sm"}`}>
            <span className="max-w-[72px] truncate">{player.name}</span>
            {player.isHost ? <Crown className="h-3.5 w-3.5 shrink-0 text-gold" /> : null}
          </span>
          <span className={`${compact ? "text-[9px]" : "text-[11px]"} ${isMe ? "text-gold-soft" : "text-slate-400"}`}>{status}</span>
        </>
      ) : (
        <>
          <span className={`mt-auto grid place-items-center rounded-full border ${interactive ? "border-jade/30 bg-jade/10 text-jade" : "border-white/10 bg-white/5 text-slate-600"} ${
            compact ? "h-9 w-9" : "h-12 w-12"
          }`}>
            <Plus className={compact ? "h-4 w-4" : "h-5 w-5"} />
          </span>
          <span className={`mb-auto font-medium ${compact ? "text-[10px]" : "text-xs"} ${interactive ? "text-jade-soft" : "text-slate-500"}`}>{status}</span>
        </>
      )}
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
    <main className={`lobby-shell relative flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-[#071014] ${isMobileLandscape ? "p-2" : "p-4"}`}>
      <div className="lobby-art pointer-events-none absolute inset-0" />
      <div className={`lobby-panel surface-modal relative w-full overflow-y-auto rounded-2xl hud-scrollbar ${
        isMobileLandscape ? "max-h-[calc(100dvh-1rem)] max-w-[min(760px,calc(100vw-1rem))] p-3" : "max-w-3xl p-6"
      }`}>
        <header className="flex items-center justify-between gap-4 border-b border-gold/20 pb-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-400">房间号</div>
            <button
              type="button"
              onClick={copyCode}
              className={`flex items-center gap-2 font-bold leading-none transition hover:brightness-110 ${
                isMobileLandscape ? "mt-1 text-2xl" : "mt-1 text-3xl"
              }`}
            >
              <span className="brand-title">{room.code}</span>
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
        </header>

        <div className={`grid ${isMobileLandscape ? "mt-3 grid-cols-[1.45fr_1fr] items-start gap-4" : "mt-5 gap-5"}`}>
          <section>
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-400">
              <span>选择风位（{room.players.length}/3）</span>
              <span className="text-slate-500">点击空位可切换</span>
            </div>
            <div className={`mt-3 grid gap-2 ${isMobileLandscape ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
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
          </section>

          <section className={`grid content-start gap-4 ${isMobileLandscape ? "border-l border-gold/15 pl-4" : "border-t border-gold/15 pt-4"}`}>
            <div className={`grid grid-cols-2 gap-y-3 text-center ${isMobileLandscape ? "text-[10px]" : "sm:grid-cols-4"}`}>
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
              <div className="grid gap-2">
                <button
                  type="button"
                  disabled={!canStart || busy}
                  onClick={() => void startGame()}
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
              <div className="border-y border-white/10 px-3 py-3 text-center text-xs text-slate-400">
                等待房主开始游戏…
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
