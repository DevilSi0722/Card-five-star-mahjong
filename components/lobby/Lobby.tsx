"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ChevronRight, LogIn, Plus, Settings, User, Users, X } from "lucide-react";
import { useRoomStore } from "@/store/roomStore";
import { useUiStore } from "@/store/uiStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { TILE_BACK_OPTIONS } from "@/utils/tileBacks";
import { TABLECLOTH_OPTIONS } from "@/utils/tablecloths";
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

function LobbySettingsModal({ onClose }: { onClose: () => void }) {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const discardPhysicsEnabled = useUiStore((s) => s.discardPhysicsEnabled);
  const setDiscardPhysicsEnabled = useUiStore((s) => s.setDiscardPhysicsEnabled);
  const tableclothId = useUiStore((s) => s.tableclothId);
  const setTableclothId = useUiStore((s) => s.setTableclothId);
  const tileBackId = useUiStore((s) => s.tileBackId);
  const setTileBackId = useUiStore((s) => s.setTileBackId);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm ${isMobileLandscape ? "p-2" : "p-4"}`}>
      <div
        className={`surface-modal w-full overflow-x-hidden overflow-y-auto rounded-2xl text-sm text-slate-100 hud-scrollbar ${
          isMobileLandscape
            ? "max-h-[calc(100dvh-1rem)] max-w-[min(720px,calc(100vw-1rem))] p-3"
            : "max-h-[calc(100dvh-2rem)] max-w-md p-5"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-base font-semibold text-bone">
            <Settings className="h-4 w-4 text-jade" />
            设置
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-white/5 text-slate-200 transition hover:border-rose-300/40 hover:bg-rose-400/15 hover:text-rose-200"
            aria-label="关闭设置"
            title="关闭设置"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={`${isMobileLandscape ? "mt-3 grid grid-cols-2 gap-2" : "mt-4 grid gap-3"}`}>
          <div className="overflow-hidden rounded-xl border border-white/12 bg-slate-900/70 p-3">
            <div className="mb-2 text-sm font-semibold text-bone">桌布</div>
            <div className={isMobileLandscape ? "max-w-full overflow-x-auto overflow-y-hidden pb-1 hud-scrollbar [touch-action:pan-x]" : ""}>
              <div className={isMobileLandscape ? "flex w-max gap-2" : "grid grid-cols-2 gap-2"}>
                {TABLECLOTH_OPTIONS.map((option) => {
                  const selected = option.id === tableclothId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTableclothId(option.id)}
                      className={`overflow-hidden rounded-xl border bg-slate-950/70 text-left transition ${isMobileLandscape ? "w-[76px] shrink-0" : ""} ${
                        selected ? "border-gold/70 shadow-[0_0_18px_rgba(233,196,106,0.2)]" : "border-white/12 hover:border-white/25"
                      }`}
                      aria-pressed={selected}
                    >
                      <span
                        className={`block bg-cover bg-center ${isMobileLandscape ? "h-12" : "h-14"}`}
                        style={{ backgroundImage: `url(${option.texture.src})` }}
                      />
                      <span className={`block truncate px-2 py-1.5 text-xs font-semibold ${selected ? "text-gold-soft" : "text-slate-300"}`}>
                        {option.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/12 bg-slate-900/70 p-3">
            <div className="mb-2 text-sm font-semibold text-bone">牌背</div>
            <div className={isMobileLandscape ? "max-w-full overflow-x-auto overflow-y-hidden pb-1 hud-scrollbar [touch-action:pan-x]" : ""}>
              <div className={isMobileLandscape ? "flex w-max gap-2" : "grid grid-cols-2 gap-2"}>
                {TILE_BACK_OPTIONS.map((option) => {
                  const selected = option.id === tileBackId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTileBackId(option.id)}
                      className={`overflow-hidden rounded-xl border bg-slate-950/70 text-left transition ${isMobileLandscape ? "w-[76px] shrink-0" : ""} ${
                        selected ? "border-gold/70 shadow-[0_0_18px_rgba(233,196,106,0.2)]" : "border-white/12 hover:border-white/25"
                      }`}
                      aria-pressed={selected}
                    >
                      <span
                        className={`block bg-contain bg-center bg-no-repeat ${isMobileLandscape ? "h-12" : "h-14"}`}
                        style={{ backgroundImage: `url(${option.src})`, backgroundColor: option.edgeColor }}
                      />
                      <span className={`block truncate px-2 py-1.5 text-xs font-semibold ${selected ? "text-gold-soft" : "text-slate-300"}`}>
                        {option.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/12 bg-slate-900/70 px-3 py-3 text-sm text-slate-200 transition hover:border-white/20 ${isMobileLandscape ? "col-span-2" : ""}`}>
            <span className="grid gap-0.5">
              <span className="font-semibold text-bone">物理碰撞弃牌</span>
              <span className="text-xs text-slate-400">进入单人或多人对局后生效</span>
            </span>
            <input
              type="checkbox"
              checked={discardPhysicsEnabled}
              onChange={(event) => setDiscardPhysicsEnabled(event.target.checked)}
              className="h-4 w-4 shrink-0 accent-jade"
            />
          </label>
        </div>

        <div className={`flex justify-end ${isMobileLandscape ? "mt-3" : "mt-5"}`}>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-b from-jade-soft to-jade-deep px-4 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(15,155,117,0.4)] transition hover:brightness-110"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}

export function Lobby({ onStartSingle }: { onStartSingle: () => void }) {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const view = useRoomStore((s) => s.view);
  const setView = useRoomStore((s) => s.setView);
  const error = useRoomStore((s) => s.error);
  const clearError = useRoomStore((s) => s.clearError);
  const [configured] = useState(isFirebaseConfigured());
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (view === "room") return <RoomWaiting />;

  // 横屏按视图给不同宽度：home/多人选择页保持紧凑；create/join 需要左右双栏，给足宽度避免表单被压窄
  const landscapeMaxW =
    view === "home"
      ? "max-w-[min(480px,calc(100vw-1rem))]"
      : view === "multiplayer"
        ? "max-w-[min(560px,calc(100vw-1rem))]"
        : "max-w-[min(680px,calc(100vw-1rem))]";
  const contentClass =
    view === "home"
      ? `relative w-full ${
          isMobileLandscape ? "max-w-[min(620px,calc(100vw-1rem))]" : "max-w-[min(680px,calc(100vw-2rem))] px-2 py-6 sm:px-4"
        }`
      : `lobby-panel surface-modal relative w-full overflow-y-auto rounded-2xl hud-scrollbar ${
          isMobileLandscape ? `max-h-[calc(100dvh-1rem)] ${landscapeMaxW} p-3` : "max-w-md p-6"
        }`;

  return (
    <main className={`lobby-shell relative flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-[#071014] ${isMobileLandscape ? "p-2" : "p-4"}`}>
      <div className="lobby-art pointer-events-none absolute inset-0" />
      {view === "home" ? (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className={`surface-panel absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-10 inline-flex items-center justify-center rounded-xl text-slate-200 transition hover:border-gold/40 hover:bg-white/12 hover:text-gold-soft ${
            isMobileLandscape ? "h-9 w-9" : "h-10 w-10"
          }`}
          aria-label="设置"
          title="设置"
        >
          <Settings className={isMobileLandscape ? "h-4 w-4" : "h-5 w-5"} />
        </button>
      ) : null}
      <div className={contentClass}>
        {view === "home" ? (
          <div className="mx-auto text-center">
            <div className={`relative mx-auto ${isMobileLandscape ? "h-36 w-36" : "h-64 w-64"}`}>
              <Image
                src="/generated/ui/brand-crest-base-1k-transparent.png"
                alt=""
                width={1024}
                height={1024}
                priority
                className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_18px_35px_rgba(0,0,0,0.62)]"
              />
              <div
                className={`brand-title absolute left-1/2 top-1/2 z-10 w-[78%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center font-bold leading-none drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)] ${
                  isMobileLandscape ? "text-[17px]" : "text-3xl"
                }`}
              >
                卡五星麻将
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className={`brand-title font-bold ${isMobileLandscape ? "text-xl" : "text-3xl"}`}>卡五星麻将</div>
            {isMobileLandscape ? null : <div className="mt-1 text-xs text-slate-400">3D 在线对战</div>}
          </div>
        )}

        {error ? (
          <div className={`rounded-lg border border-rose-300/30 bg-rose-400/12 px-3 py-2 text-xs text-rose-200 ${isMobileLandscape ? "mt-3" : "mt-4"}`}>
            {error}
          </div>
        ) : null}

        {view === "home" ? (
          <div className={`mx-auto grid ${isMobileLandscape ? "mt-3 max-w-[540px] grid-cols-2 gap-3" : "mt-5 max-w-[34rem] grid-cols-1 gap-4 sm:grid-cols-2"}`}>
            <button
              type="button"
              onClick={onStartSingle}
              className={`group relative flex items-center overflow-hidden rounded-xl border border-jade/30 bg-[linear-gradient(105deg,rgba(9,49,45,0.78),rgba(7,16,26,0.58))] text-left shadow-[0_14px_32px_rgba(0,0,0,0.22)] transition hover:border-jade/65 hover:bg-[linear-gradient(105deg,rgba(10,67,57,0.84),rgba(7,18,28,0.72))] ${
                isMobileLandscape ? "min-h-[72px] gap-2 px-3 py-2.5" : "min-h-[116px] gap-4 px-5 py-4"
              }`}
            >
              <span className="absolute inset-y-0 left-0 w-1 bg-jade" />
              <span className={`grid shrink-0 place-items-center rounded-full border border-jade/40 bg-jade/10 ${isMobileLandscape ? "h-9 w-9" : "h-14 w-14"}`}>
                <User className={isMobileLandscape ? "h-4 w-4 text-jade" : "h-6 w-6 text-jade"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold text-bone ${isMobileLandscape ? "text-xs" : "text-base"}`}>单人模式</span>
                <span className={`block text-slate-400 ${isMobileLandscape ? "mt-0.5 text-[10px] leading-tight" : "mt-1 text-xs"}`}>与两位电脑对手对战</span>
              </span>
              <ChevronRight className={`${isMobileLandscape ? "h-4 w-4" : "h-5 w-5"} shrink-0 text-jade/70 transition group-hover:translate-x-0.5 group-hover:text-jade-soft`} />
            </button>

            <button
              type="button"
              onClick={() => {
                if (!configured) return;
                clearError();
                setView("multiplayer");
              }}
              disabled={!configured}
              className={`group relative flex items-center overflow-hidden rounded-xl border border-gold/30 bg-[linear-gradient(105deg,rgba(65,45,14,0.72),rgba(18,20,27,0.58))] text-left shadow-[0_14px_32px_rgba(0,0,0,0.22)] transition hover:border-gold/65 hover:bg-[linear-gradient(105deg,rgba(82,57,16,0.8),rgba(24,22,25,0.72))] disabled:cursor-not-allowed disabled:opacity-50 ${
                isMobileLandscape ? "min-h-[72px] gap-2 px-3 py-2.5" : "min-h-[116px] gap-4 px-5 py-4"
              }`}
            >
              <span className="absolute inset-y-0 left-0 w-1 bg-gold" />
              <span className={`grid shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10 ${isMobileLandscape ? "h-9 w-9" : "h-14 w-14"}`}>
                <Users className={isMobileLandscape ? "h-4 w-4 text-gold" : "h-6 w-6 text-gold"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold text-bone ${isMobileLandscape ? "text-xs" : "text-base"}`}>多人模式</span>
                <span className={`block text-slate-400 ${isMobileLandscape ? "mt-0.5 text-[10px] leading-tight" : "mt-1 text-xs"}`}>
                  {configured ? "创建或加入房间，与好友联机" : "未配置联机服务，暂不可用"}
                </span>
              </span>
              <ChevronRight className={`${isMobileLandscape ? "h-4 w-4" : "h-5 w-5"} shrink-0 text-gold/70 transition group-hover:translate-x-0.5 group-hover:text-gold-soft`} />
            </button>
          </div>
        ) : null}

        {view === "multiplayer" ? (
          <div className={`${isMobileLandscape ? "mt-3 grid gap-2" : "mt-5 grid gap-4"}`}>
            <NameField />
            <div className={`grid gap-3 ${isMobileLandscape ? "grid-cols-2" : "grid-cols-1"}`}>
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setView("create");
                }}
                className={`surface-panel flex items-center gap-3 rounded-xl text-left transition hover:border-gold/40 ${
                  isMobileLandscape ? "px-3 py-2.5" : "px-4 py-3.5"
                }`}
              >
                <span className={`grid shrink-0 place-items-center rounded-lg bg-gold/15 ${isMobileLandscape ? "h-9 w-9" : "h-10 w-10"}`}>
                  <Plus className={`${isMobileLandscape ? "h-4 w-4" : "h-5 w-5"} text-gold`} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-bone">创建房间</span>
                  <span className="block truncate text-xs text-slate-400">设置规则，邀请好友加入</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  clearError();
                  setView("join");
                }}
                className={`surface-panel flex items-center gap-3 rounded-xl text-left transition hover:border-jade/40 ${
                  isMobileLandscape ? "px-3 py-2.5" : "px-4 py-3.5"
                }`}
              >
                <span className={`grid shrink-0 place-items-center rounded-lg bg-jade/15 ${isMobileLandscape ? "h-9 w-9" : "h-10 w-10"}`}>
                  <LogIn className={`${isMobileLandscape ? "h-4 w-4" : "h-5 w-5"} text-jade`} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-bone">加入房间</span>
                  <span className="block truncate text-xs text-slate-400">输入房间号快速入座</span>
                </span>
              </button>
            </div>
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
          </div>
        ) : null}

        {view === "create" || view === "join" ? (
          (() => {
            const form = view === "create" ? <CreateRoomForm compact={isMobileLandscape} /> : <JoinRoomForm compact={isMobileLandscape} />;
            const title = view === "create" ? "创建房间" : "加入房间";
            const back = (
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setView("multiplayer");
                }}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                返回
              </button>
            );

            // 横屏：顶部横条「昵称 + 标签页」并排，表单占满整宽，返回在底；竖屏：单列堆叠
            return isMobileLandscape ? (
              <div className="mt-2 grid gap-2">
                <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                  <NameField />
                  <div className="flex h-10 items-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-gold-soft">
                    {title}
                  </div>
                </div>
                {form}
                <div className="flex justify-center">{back}</div>
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                <div className="text-center text-base font-semibold text-gold-soft">{title}</div>
                <NameField />
                {form}
                {back}
              </div>
            );
          })()
        ) : null}
      </div>
      {settingsOpen ? <LobbySettingsModal onClose={() => setSettingsOpen(false)} /> : null}
    </main>
  );
}
