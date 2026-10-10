"use client";

import { useSyncExternalStore } from "react";
import { getInitialRealtimeConnection, getRealtimeConnection, subscribeRealtimeConnection } from "@/lib/multiplayer/realtimeClient";
import { useRoomStore } from "@/store/roomStore";

export function RealtimeStatus({ compact = false }: { compact?: boolean }) {
  const connection = useSyncExternalStore(subscribeRealtimeConnection, getRealtimeConnection, getInitialRealtimeConnection);
  const error = useRoomStore((state) => state.error);
  const clearError = useRoomStore((state) => state.clearError);
  const connected = connection.status === "connected";
  const label = connected ? connection.latencyMs === null ? "已连接" : `已连接 · ${connection.latencyMs} ms`
    : connection.status === "connecting" ? "正在连接…" : "正在重连，恢复牌局中…";
  return (
    <div className={`grid gap-1 ${compact ? "text-[9px]" : "text-[11px]"}`}>
      <div role="status" title="网络往返延迟" className={`surface-panel flex items-center gap-1.5 rounded-xl px-2 py-1.5 ${connected ? "text-jade-soft" : "text-amber-200"}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? "bg-jade" : "animate-pulse bg-amber-300"}`} />
        <span>{label}</span>
      </div>
      {error ? <button type="button" onClick={clearError} aria-label="关闭联机提示" className="surface-panel rounded-xl border-amber-300/30 px-2 py-1.5 text-left text-amber-100">
        {error} <span aria-hidden="true">×</span>
      </button> : null}
    </div>
  );
}
