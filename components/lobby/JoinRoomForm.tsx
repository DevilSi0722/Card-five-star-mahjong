"use client";

import { useState } from "react";
import { useRoomStore } from "@/store/roomStore";

export function JoinRoomForm() {
  const joinExistingRoom = useRoomStore((s) => s.joinExistingRoom);
  const busy = useRoomStore((s) => s.busy);
  const [code, setCode] = useState("");

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-slate-300">房间号</span>
        <input
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="0000"
          className="h-12 rounded-lg border border-white/12 bg-slate-900/70 px-3 text-center text-2xl font-bold tracking-[0.5em] text-white outline-none transition focus:border-jade/60 focus:ring-1 focus:ring-jade/30"
        />
      </div>

      <button
        type="button"
        disabled={busy || code.length !== 4}
        onClick={() => joinExistingRoom(code)}
        className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-jade-soft to-jade-deep font-semibold text-white shadow-[0_8px_22px_rgba(15,155,117,0.4)] transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "加入中…" : "加入房间"}
      </button>
    </div>
  );
}
