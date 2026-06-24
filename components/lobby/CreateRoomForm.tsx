"use client";

import { useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import { DEFAULT_ROOM_SETTINGS, formatRoomRoundLimit, ROOM_ROUND_OPTIONS, type RoomSettings } from "@/types/multiplayer";
import { formatWinMultiplierLimit, WIN_MULTIPLIER_LIMIT_OPTIONS } from "@/utils/mahjong/winMultiplierLimit";

export function CreateRoomForm({ compact = false }: { compact?: boolean }) {
  const createNewRoom = useRoomStore((s) => s.createNewRoom);
  const busy = useRoomStore((s) => s.busy);
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [code, setCode] = useState("");
  const [autoCode, setAutoCode] = useState(true);

  function patch(next: Partial<RoomSettings>) {
    setSettings((prev) => ({ ...prev, ...next }));
  }

  const fieldGapClass = compact ? "gap-1" : "gap-1.5";
  const labelClass = compact ? "text-[10px] font-medium leading-none text-slate-300" : "text-xs font-medium text-slate-300";
  const optionButtonClass = compact ? "h-7 rounded-md text-[9px]" : "h-9 rounded-lg text-xs";
  const multiplierButtonClass = compact ? "h-7 rounded-md text-[10px]" : "h-9 rounded-lg text-[11px]";
  const inputHeightClass = compact ? "h-7" : "h-10";

  return (
    <div className={`grid ${compact ? "gap-2" : "gap-3"}`}>
      {/* 横屏：压成两行设置区，避免移动端创建房间页需要滚动。竖屏：保持单列堆叠。 */}
      <div className={compact ? "grid grid-cols-[1.2fr_0.58fr_1fr] items-start gap-x-2 gap-y-2" : "contents"}>
        <div className={`grid ${fieldGapClass}`}>
          <span className={labelClass}>总局数</span>
          <div className={`grid grid-cols-5 ${compact ? "gap-1" : "gap-1.5"}`}>
            {ROOM_ROUND_OPTIONS.map((r) => {
              const active = settings.rounds === r;
              return (
                <button
                  key={r ?? "unlimited"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => patch({ rounds: r })}
                  className={`relative border font-bold transition ${optionButtonClass} ${
                    active
                      ? "scale-[1.03] border-gold bg-gradient-to-b from-[#f7e6b8] via-gold to-gold-deep text-slate-900 shadow-[0_4px_14px_rgba(233,196,106,0.38)]"
                      : "border-white/12 bg-slate-900/60 text-slate-300 hover:border-gold/40 hover:text-gold-soft"
                  }`}
                >
                  {formatRoomRoundLimit(r, compact)}
                </button>
              );
            })}
          </div>
        </div>

        <label className={`grid ${fieldGapClass}`}>
          <span className={labelClass}>底分</span>
          <input
            type="number"
            min={1}
            step={1}
            value={settings.baseScore}
            onChange={(e) => patch({ baseScore: Math.max(1, Number.parseInt(e.target.value, 10) || 1) })}
            className={`rounded-lg border border-white/12 bg-slate-900/70 px-3 text-sm font-semibold text-white outline-none transition focus:border-jade/60 focus:ring-1 focus:ring-jade/30 ${inputHeightClass}`}
          />
        </label>

        <div className={compact ? `grid ${fieldGapClass}` : "contents"}>
          {compact ? <span className={labelClass}>买马</span> : null}
          <label
            className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/12 bg-slate-900/70 text-slate-200 transition hover:border-white/20 ${
              compact ? "min-h-7 px-2 text-[11px]" : "px-3 py-2.5 text-sm"
            }`}
          >
            <span className={compact ? "leading-tight" : ""}>亮倒自摸买马</span>
            <input
              type="checkbox"
              checked={settings.liangDaoZimoBuyHorse}
              onChange={(e) => patch({ liangDaoZimoBuyHorse: e.target.checked })}
              className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0 accent-jade`}
            />
          </label>
        </div>

        <div className={`grid ${fieldGapClass} ${compact ? "col-span-2" : ""}`}>
          <span className={labelClass}>胡牌倍率封顶</span>
          <div className={`grid grid-cols-5 ${compact ? "gap-1" : "gap-1.5"}`}>
            {WIN_MULTIPLIER_LIMIT_OPTIONS.map((limit) => {
              const active = settings.maxWinMultiplier === limit;
              return (
                <button
                  key={limit ?? "unlimited"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => patch({ maxWinMultiplier: limit })}
                  className={`border font-bold transition ${multiplierButtonClass} ${
                    active
                      ? "scale-[1.02] border-gold bg-gradient-to-b from-[#f7e6b8] via-gold to-gold-deep text-slate-900 shadow-[0_4px_12px_rgba(233,196,106,0.34)]"
                      : "border-white/12 bg-slate-900/60 text-slate-300 hover:border-gold/40 hover:text-gold-soft"
                  }`}
                >
                  {formatWinMultiplierLimit(limit)}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`grid ${fieldGapClass}`}>
          <span className={labelClass}>房间号</span>
          <label className={`flex cursor-pointer items-center gap-1.5 text-slate-400 ${compact ? "min-h-7 text-[10px]" : "text-xs"}`}>
            <input
              type="checkbox"
              checked={autoCode}
              onChange={(e) => setAutoCode(e.target.checked)}
              className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} shrink-0 accent-jade`}
            />
            <span>{compact ? "随机生成" : "随机生成 4 位房间号"}</span>
          </label>
          {!autoCode ? (
            <input
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="自定义 4 位数字"
              className={`rounded-lg border border-white/12 bg-slate-900/70 px-3 text-center font-bold tracking-[0.32em] text-white outline-none transition focus:border-jade/60 focus:ring-1 focus:ring-jade/30 ${
                compact ? "h-7 text-sm" : "h-10 text-lg"
              }`}
            />
          ) : null}
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => createNewRoom(settings, autoCode ? undefined : code)}
        className={`surface-panel inline-flex items-center justify-center rounded-xl border-gold/40 font-semibold transition hover:border-gold/70 hover:brightness-110 disabled:opacity-60 ${
          compact ? "h-8 text-xs" : "mt-1 h-11"
        }`}
      >
        <span className="bg-gradient-to-b from-[#f7e6b8] via-gold to-gold-deep bg-clip-text text-transparent">
          {busy ? "创建中…" : "创建房间"}
        </span>
      </button>
    </div>
  );
}
