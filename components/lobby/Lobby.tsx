"use client";

import { useState } from "react";
import { Users, User, ArrowLeft } from "lucide-react";
import { useRoomStore } from "@/store/roomStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { CreateRoomForm } from "./CreateRoomForm";
import { JoinRoomForm } from "./JoinRoomForm";
import { RoomWaiting } from "./RoomWaiting";

/** 昵称输入（多人模式各视图共用）。 */
function NameField() {
  const playerName = useRoomStore((s) => s.playerName);
  const setPlayerName = useRoomStore((s) => s.setPlayerName);
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-slate-300">你的昵称</span>
      <input
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        maxLength={12}
        placeholder="输入昵称"
        className="h-10 rounded-lg border border-white/12 bg-slate-900/70 px-3 text-sm font-semibold text-white outline-none transition focus:border-jade/60 focus:ring-1 focus:ring-jade/30"
      />
    </label>
  );
}

export function Lobby({ onStartSingle }: { onStartSingle: () => void }) {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const view = useRoomStore((s) => s.view);
  const setView = useRoomStore((s) => s.setView);
  const error = useRoomStore((s) => s.error);
  const clearError = useRoomStore((s) => s.clearError);
  const [configured] = useState(isFirebaseConfigured());

  if (view === "room") return <RoomWaiting />;

  // 横屏按视图给不同宽度：home 两按钮并排用中等宽度；create/join 需要左右双栏，给足宽度避免表单被压窄
  const landscapeMaxW =
    view === "home"
      ? "max-w-[min(480px,calc(100vw-1rem))]"
      : "max-w-[min(680px,calc(100vw-1rem))]";

  return (
    <main className={`relative flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-[#071014] ${isMobileLandscape ? "p-2" : "p-4"}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(233,196,106,0.08),transparent_60%)]" />
      <div className={`surface-modal relative w-full overflow-y-auto rounded-2xl hud-scrollbar ${
        isMobileLandscape ? `max-h-[calc(100dvh-1rem)] ${landscapeMaxW} p-4` : "max-w-sm p-6"
      }`}>
        <div className="text-center">
          <div className={`brand-title font-bold ${isMobileLandscape ? "text-2xl" : "text-3xl"}`}>卡五星麻将</div>
          {isMobileLandscape && view !== "home" ? null : (
            <div className="mt-1 text-xs tracking-[0.3em] text-slate-400">3D 在线对战</div>
          )}
        </div>

        {error ? (
          <div className={`rounded-lg border border-rose-300/30 bg-rose-400/12 px-3 py-2 text-xs text-rose-200 ${isMobileLandscape ? "mt-3" : "mt-4"}`}>
            {error}
          </div>
        ) : null}

        {view === "home" ? (
          <div className={`grid gap-3 ${isMobileLandscape ? "mt-4 grid-cols-2" : "mt-6"}`}>
            <button
              type="button"
              onClick={onStartSingle}
              className="surface-panel flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition hover:border-jade/40"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-jade/15">
                <User className="h-5 w-5 text-jade" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-bone">单人模式</span>
                <span className="block text-xs text-slate-400">与两位电脑对手对战</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!configured) return;
                clearError();
                setView("create");
              }}
              disabled={!configured}
              className="surface-panel flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition hover:border-gold/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold/15">
                <Users className="h-5 w-5 text-gold" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-bone">多人模式</span>
                <span className="block text-xs text-slate-400">
                  {configured ? "创建或加入房间，与好友联机" : "未配置联机服务，暂不可用"}
                </span>
              </span>
            </button>
          </div>
        ) : null}

        {view === "create" || view === "join" ? (
          (() => {
            const tabs = (
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setView("create")}
                  className={`h-9 rounded-md text-xs font-semibold transition ${
                    view === "create" ? "bg-gold/20 text-gold-soft" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  创建房间
                </button>
                <button
                  type="button"
                  onClick={() => setView("join")}
                  className={`h-9 rounded-md text-xs font-semibold transition ${
                    view === "join" ? "bg-gold/20 text-gold-soft" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  加入房间
                </button>
              </div>
            );
            const form = view === "create" ? <CreateRoomForm compact={isMobileLandscape} /> : <JoinRoomForm compact={isMobileLandscape} />;
            const back = (
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setView("home");
                }}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                返回
              </button>
            );

            // 横屏：顶部横条「昵称 + 标签页」并排，表单占满整宽，返回在底；竖屏：单列堆叠
            return isMobileLandscape ? (
              <div className="mt-3 grid gap-3">
                <div className="grid grid-cols-[1fr_1fr] items-end gap-3">
                  <NameField />
                  {tabs}
                </div>
                {form}
                <div className="flex justify-center">{back}</div>
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                <NameField />
                {tabs}
                {form}
                {back}
              </div>
            );
          })()
        ) : null}
      </div>
    </main>
  );
}
