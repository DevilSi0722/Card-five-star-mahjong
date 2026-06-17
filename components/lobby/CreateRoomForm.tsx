"use client";

import { useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import { DEFAULT_ROOM_SETTINGS, type RoomSettings } from "@/types/multiplayer";
import { formatWinMultiplierLimit, WIN_MULTIPLIER_LIMIT_OPTIONS } from "@/utils/mahjong/winMultiplierLimit";

const ROUND_OPTIONS = [1, 4, 8, 16];

export function CreateRoomForm({ compact = false }: { compact?: boolean }) {
  const createNewRoom = useRoomStore((s) => s.createNewRoom);
  const busy = useRoomStore((s) => s.busy);
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [code, setCode] = useState("");
  const [autoCode, setAutoCode] = useState(true);

  function patch(next: Partial<RoomSettings>) {
    setSettings((prev) => ({ ...prev, ...next }));
  }

  return (
    <div className="grid gap-3">
      {/* 横屏：四项排成 2×2 网格（上排 总局数｜底分，下排 买马｜房间号），用宽度换高度；竖屏：单列堆叠 */}
      <div className={compact ? "grid grid-cols-2 items-start gap-x-4 gap-y-3" : "contents"}>
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-slate-300">总局数</span>
          <div className="grid grid-cols-4 gap-2">
            {ROUND_OPTIONS.map((r) => {
              const active = settings.rounds === r;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={active}
                  onClick={() => patch({ rounds: r })}
                  className={`relative h-9 rounded-lg border text-xs font-bold transition ${
                    active
                      ? "border-gold bg-gradient-to-b from-[#f7e6b8] via-gold to-gold-deep text-slate-900 shadow-[0_4px_14px_rgba(233,196,106,0.45)] scale-[1.04]"
                      : "border-white/12 bg-slate-900/60 text-slate-300 hover:border-gold/40 hover:text-gold-soft"
                  }`}
                >
                  {r} 局
                </button>
              );
            })}
          </div>
        </div>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-slate-300">底分</span>
          <input
            type="number"
            min={1}
            step={1}
            value={settings.baseScore}
            onChange={(e) => patch({ baseScore: Math.max(1, Number.parseInt(e.target.value, 10) || 1) })}
            className={`rounded-lg border border-white/12 bg-slate-900/70 px-3 text-sm font-semibold text-white outline-none transition focus:border-jade/60 focus:ring-1 focus:ring-jade/30 ${
              compact ? "h-9" : "h-10"
            }`}
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/12 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-200 transition hover:border-white/20">
          <span>开启亮倒自摸买马</span>
          <input
            type="checkbox"
            checked={settings.liangDaoZimoBuyHorse}
            onChange={(e) => patch({ liangDaoZimoBuyHorse: e.target.checked })}
            className="h-4 w-4 accent-jade"
          />
        </label>

        <div className={`grid gap-1.5 ${compact ? "col-span-2" : ""}`}>
          <span className="text-xs font-medium text-slate-300">胡牌倍率封顶</span>
          <div className="grid grid-cols-5 gap-1.5">
            {WIN_MULTIPLIER_LIMIT_OPTIONS.map((limit) => {
              const active = settings.maxWinMultiplier === limit;
              return (
                <button
                  key={limit ?? "unlimited"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => patch({ maxWinMultiplier: limit })}
                  className={`h-9 rounded-lg border text-[11px] font-bold transition ${
                    active
                      ? "scale-[1.03] border-gold bg-gradient-to-b from-[#f7e6b8] via-gold to-gold-deep text-slate-900 shadow-[0_4px_14px_rgba(233,196,106,0.38)]"
                      : "border-white/12 bg-slate-900/60 text-slate-300 hover:border-gold/40 hover:text-gold-soft"
                  }`}
                >
                  {formatWinMultiplierLimit(limit)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-slate-300">房间号</span>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={autoCode}
              onChange={(e) => setAutoCode(e.target.checked)}
              className="h-3.5 w-3.5 accent-jade"
            />
            随机生成 4 位房间号
          </label>
          {!autoCode ? (
            <input
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="自定义 4 位数字"
              className={`rounded-lg border border-white/12 bg-slate-900/70 px-3 text-center text-lg font-bold tracking-[0.4em] text-white outline-none transition focus:border-jade/60 focus:ring-1 focus:ring-jade/30 ${
                compact ? "h-9" : "h-10"
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
          compact ? "h-10" : "mt-1 h-11"
        }`}
      >
        <span className="bg-gradient-to-b from-[#f7e6b8] via-gold to-gold-deep bg-clip-text text-transparent">
          {busy ? "创建中…" : "创建房间"}
        </span>
      </button>
    </div>
  );
}
