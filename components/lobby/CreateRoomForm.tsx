"use client";

import { useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import { DEFAULT_ROOM_SETTINGS, type RoomSettings } from "@/types/multiplayer";

const ROUND_OPTIONS = [1, 4, 8, 16];

export function CreateRoomForm() {
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
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-slate-300">总局数</span>
        <div className="grid grid-cols-4 gap-2">
          {ROUND_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => patch({ rounds: r })}
              className={`h-9 rounded-lg border text-xs font-semibold transition ${
                settings.rounds === r
                  ? "border-gold/60 bg-gold/15 text-gold-soft"
                  : "border-white/12 bg-slate-900/60 text-slate-300 hover:border-white/25"
              }`}
            >
              {r} 局
            </button>
          ))}
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
          className="h-10 rounded-lg border border-white/12 bg-slate-900/70 px-3 text-sm font-semibold text-white outline-none transition focus:border-jade/60 focus:ring-1 focus:ring-jade/30"
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
            className="h-10 rounded-lg border border-white/12 bg-slate-900/70 px-3 text-center text-lg font-bold tracking-[0.4em] text-white outline-none transition focus:border-jade/60 focus:ring-1 focus:ring-jade/30"
          />
        ) : null}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => createNewRoom(settings, autoCode ? undefined : code)}
        className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-gold-soft to-gold-deep font-semibold text-ink shadow-[0_8px_22px_rgba(233,196,106,0.4)] transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "创建中…" : "创建房间"}
      </button>
    </div>
  );
}
