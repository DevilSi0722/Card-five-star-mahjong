"use client";

import { useState } from "react";
import { useRoomStore } from "@/store/roomStore";

export function JoinRoomForm({ compact = false }: { compact?: boolean }) {
  const joinExistingRoom = useRoomStore((s) => s.joinExistingRoom);
  const busy = useRoomStore((s) => s.busy);
  const [code, setCode] = useState("");

  return (
    <div className="grid gap-3">
      {/* 横屏：房间号输入 + 加入按钮并排，用满整宽避免空旷；竖屏：上下堆叠 */}
      <div className={compact ? "grid grid-cols-[1fr_auto] items-end gap-3" : "contents"}>
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-slate-300">房间号</span>
          <input
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="0000"
            className={`rounded-lg border border-white/12 bg-slate-900/70 px-3 text-center font-bold tracking-[0.5em] text-white outline-none transition focus:border-jade/60 focus:ring-1 focus:ring-jade/30 ${
              compact ? "h-11 text-xl" : "h-12 text-2xl"
            }`}
          />
        </div>

        <button
          type="button"
          disabled={busy || code.length !== 4}
          onClick={() => joinExistingRoom(code)}
          className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-jade-soft to-jade-deep font-semibold text-white shadow-[0_8px_22px_rgba(15,155,117,0.4)] transition hover:brightness-110 disabled:opacity-60 ${
            compact ? "h-11 px-6" : "mt-1 h-11"
          }`}
        >
          {busy ? "加入中…" : "加入房间"}
        </button>
      </div>
    </div>
  );
}
