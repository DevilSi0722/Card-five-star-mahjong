"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { BadgeCheck, CircleDot, LogOut, MessageCircle, RotateCcw, SendHorizontal, Settings, Volume2, VolumeX, X } from "lucide-react";
import type { Player, PlayerId } from "@/types/mahjong";
import type { QuickChatMessage, RoomPlayer } from "@/types/multiplayer";
import { WIND_LABEL, type EngineSeatId, type Wind } from "@/types/multiplayer";
import { useGameStore } from "@/store/gameStore";
import { useRoomStore } from "@/store/roomStore";
import { useUiStore } from "@/store/uiStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { analyzeWin, getAnGangKinds, getTingDiscardOptions } from "@/utils/mahjong/handAnalyzer";
import { ActionPanel } from "./ActionPanel";

// 每个显示座位一套固定配色。多人模式昵称会变化，颜色必须跟座位走，不能跟名字匹配。
type PlayerTone = { chip: string; dot: string; text: string };

const PLAYER_TONES: Record<PlayerId, PlayerTone> = {
  human: { chip: "border-emerald-300/35 bg-emerald-400/15 text-emerald-100", dot: "bg-emerald-400", text: "text-emerald-100" },
  ai_left: { chip: "border-sky-300/35 bg-sky-400/15 text-sky-100", dot: "bg-sky-400", text: "text-sky-100" },
  ai_right: { chip: "border-amber-300/35 bg-amber-400/15 text-amber-100", dot: "bg-amber-400", text: "text-amber-100" },
};

const SCORE_PANEL_PLAYER_ORDER: EngineSeatId[] = ["human", "ai_right", "ai_left"];
const QUICK_CHAT_MESSAGES = [
  "快点快点，茶都凉了",
  "这牌也太会折磨人了",
  "刚才那张我后悔三秒",
  "别碰我牌，我有预感",
  "你这牌打得像开了导航",
  "稳住，我在酝酿大事",
  "这都能摸到？离谱但合理",
  "给条活路，别再杠了",
];
const QUICK_CHAT_VISIBLE_MS = 5000;

function playerTone(id: PlayerId): PlayerTone {
  return PLAYER_TONES[id];
}

// 牌桌左右两侧玩家名称标签（多人模式用，让左右两位玩家身份一眼可辨）。
function SideNameTag({
  player,
  side,
  isCurrent,
  compact,
  wind,
}: {
  player: Player;
  side: "left" | "right";
  isCurrent: boolean;
  compact: boolean;
  wind?: Wind;
}) {
  const tone = playerTone(player.id);
  return (
    <div
      className={`pointer-events-none fixed top-1/2 z-10 -translate-y-1/2 ${
        side === "left" ? "left-0" : "right-0"
      } ${compact ? "px-1" : "px-2"}`}
    >
      <div
        className={`surface-panel flex flex-col gap-0.5 rounded-xl ${
          compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
        } ${isCurrent ? "ring-1 ring-inset ring-gold/40" : ""}`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isCurrent ? "bg-gold" : tone.dot}`} />
          {player.isLiangDao ? <BadgeCheck className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-gold`} /> : null}
          <span className={`max-w-[72px] truncate font-semibold ${isCurrent ? "text-gold-soft" : tone.text}`}>
            {player.name}
          </span>
          <span className={`font-semibold tabular-nums ${scoreClass(player.score)}`}>
            {player.score > 0 ? `+${player.score}` : player.score}
          </span>
        </div>
        {wind ? <span className="text-[10px] font-medium text-gold-soft/80">{WIND_LABEL[wind]}风</span> : null}
      </div>
    </div>
  );
}

// 把一条日志拆成「玩家 + 事件正文」，无玩家前缀的视为系统事件
function parseLog(log: string, players: Record<PlayerId, Player>): { player: (PlayerTone & { name: string }) | null; body: string } {
  const player = SCORE_PANEL_PLAYER_ORDER
    .map((id) => ({ ...playerTone(id), name: players[id].name }))
    .sort((a, b) => b.name.length - a.name.length)
    .find((candidate) => log.startsWith(candidate.name));
  if (!player) return { player: null, body: log };
  return { player, body: log.slice(player.name.length).trim() };
}

// 根据事件关键字给正文上色，区分不同动作
function eventToneClass(body: string): string {
  if (/胡|自摸|杠上开花/.test(body)) return "text-yellow-200 font-semibold";
  if (/杠/.test(body)) return "text-fuchsia-200";
  if (/碰/.test(body)) return "text-violet-200";
  if (/亮倒/.test(body)) return "text-sky-200";
  if (/流局/.test(body)) return "text-rose-200";
  if (/打出/.test(body)) return "text-slate-100";
  return "text-slate-300";
}

function scoreClass(score: number): string {
  if (score > 0) return "text-emerald-200";
  if (score < 0) return "text-rose-300";
  return "text-slate-300";
}

function quickChatSenderSeat(
  message: QuickChatMessage,
  roomPlayers: RoomPlayer[],
  players: Record<PlayerId, Player>,
  netWinds?: Record<EngineSeatId, Wind>,
): EngineSeatId | null {
  const sender = roomPlayers.find((player) => player.clientId === message.clientId);
  if (sender && netWinds) {
    return SCORE_PANEL_PLAYER_ORDER.find((seat) => netWinds[seat] === sender.wind) ?? null;
  }
  return SCORE_PANEL_PLAYER_ORDER.find((seat) => players[seat].name === message.playerName) ?? null;
}

function QuickChatBubble({
  message,
  seat,
  compact,
}: {
  message: QuickChatMessage;
  seat: EngineSeatId;
  compact: boolean;
}) {
  const isMine = seat === "human";
  const isLeft = seat === "ai_left";
  const isRight = seat === "ai_right";
  const positionClass = isMine
    ? compact
      ? "bottom-[6.15rem] left-[max(0.6rem,env(safe-area-inset-left))] max-w-[min(260px,38vw)]"
      : "bottom-[11.25rem] left-4 max-w-[min(360px,calc(100vw-2rem))] sm:left-6"
    : isLeft
      ? compact
        ? "left-[max(3.25rem,calc(env(safe-area-inset-left)+3rem))] top-1/2 max-w-[min(245px,34vw)] -translate-y-[calc(50%+2.65rem)]"
        : "left-[6.25rem] top-1/2 max-w-[min(320px,34vw)] -translate-y-[calc(50%+3.1rem)]"
      : compact
        ? "right-[max(3.25rem,calc(env(safe-area-inset-right)+3rem))] top-1/2 max-w-[min(245px,34vw)] -translate-y-[calc(50%+2.65rem)]"
        : "right-[6.25rem] top-1/2 max-w-[min(320px,34vw)] -translate-y-[calc(50%+3.1rem)]";
  const animationClass = isLeft
    ? "quick-chat-bubble--left"
    : isRight
      ? "quick-chat-bubble--right"
      : "quick-chat-bubble--mine";
  const toneClass = isMine
    ? "quick-chat-bubble-surface--mine border-jade/45 text-bone"
    : "quick-chat-bubble-surface--other border-gold/45 text-bone";
  const tailClass = isLeft
    ? "quick-chat-bubble-tail--left"
    : isRight
      ? "quick-chat-bubble-tail--right"
      : "quick-chat-bubble-tail--mine";

  return (
    <div
      className={`pointer-events-none fixed z-30 ${positionClass}`}
    >
      <div
        className={`quick-chat-bubble ${animationClass} ${toneClass} ${tailClass} relative rounded-2xl border px-3 py-2 ${compact ? "text-[11px]" : "text-sm"} ${isRight ? "text-right" : "text-left"}`}
      >
        <div className={`relative z-10 font-semibold leading-snug text-bone drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)] ${compact ? "text-[12px]" : "text-sm"}`}>
          {message.text}
        </div>
      </div>
    </div>
  );
}

function QuickChatPanel({
  compact,
  onSend,
}: {
  compact: boolean;
  onSend: (text: string) => void;
}) {
  return (
    <div
      className={`pointer-events-auto fixed z-40 ${
        compact
          ? "bottom-[6.05rem] left-[max(0.5rem,env(safe-area-inset-left))] w-[min(330px,44vw)]"
          : "bottom-[9.1rem] left-4 w-[min(360px,calc(100vw-2rem))] sm:left-6"
      }`}
    >
      <div className={`surface-modal rounded-2xl ${compact ? "p-2" : "p-3"}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className={`flex items-center gap-1.5 font-semibold text-bone ${compact ? "text-[11px]" : "text-xs"}`}>
            <MessageCircle className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} text-jade`} />
            快捷聊天
          </div>
          <span className={`${compact ? "text-[9px]" : "text-[10px]"} text-slate-500`}>发送后全房间可见</span>
        </div>
        <div className={`grid gap-1.5 ${compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
          {QUICK_CHAT_MESSAGES.map((message) => (
            <button
              key={message}
              type="button"
              onClick={() => onSend(message)}
              className={`group flex min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-2.5 text-left font-semibold text-slate-100 transition hover:border-jade/45 hover:bg-jade/12 hover:text-jade-soft ${
                compact ? "h-8 text-[11px]" : "min-h-10 text-xs"
              }`}
            >
              <span className="min-w-0 truncate">{message}</span>
              <SendHorizontal className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} shrink-0 text-slate-500 transition group-hover:text-jade`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const baseScore = useGameStore((state) => state.baseScore);
  const nextBaseScore = useGameStore((state) => state.nextBaseScore);
  const liangDaoZimoBuyHorseEnabled = useGameStore((state) => state.liangDaoZimoBuyHorseEnabled);
  const saveNextRoundSettings = useGameStore((state) => state.saveNextRoundSettings);
  const netRole = useGameStore((state) => state.netRole);
  const room = useRoomStore((state) => state.room);
  const isMultiplayer = netRole !== "single";
  const [draftBaseScore, setDraftBaseScore] = useState(String(nextBaseScore));
  const [draftBuyHorseEnabled, setDraftBuyHorseEnabled] = useState(liangDaoZimoBuyHorseEnabled);

  useEffect(() => {
    setDraftBaseScore(String(nextBaseScore));
    setDraftBuyHorseEnabled(liangDaoZimoBuyHorseEnabled);
  }, [nextBaseScore, liangDaoZimoBuyHorseEnabled]);

  function saveSettings() {
    const parsedBaseScore = Number.parseInt(draftBaseScore, 10);
    saveNextRoundSettings({
      baseScore: isMultiplayer
        ? baseScore
        : Number.isFinite(parsedBaseScore)
          ? parsedBaseScore
          : nextBaseScore,
      liangDaoZimoBuyHorseEnabled: isMultiplayer ? liangDaoZimoBuyHorseEnabled : draftBuyHorseEnabled,
    });
    onClose();
  }

  return (
    <div className={`pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm ${isMobileLandscape ? "p-2" : "p-4"}`}>
      <div
        className={`surface-modal w-full overflow-y-auto rounded-2xl text-sm text-slate-100 hud-scrollbar ${
          isMobileLandscape ? "max-h-[calc(100dvh-1rem)] max-w-[min(620px,calc(100vw-1rem))] p-3" : "max-w-sm p-5"
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

        {/* 横屏：左右双栏（左=当前状态，右=下局设置），用宽度换高度；竖屏：单列堆叠 */}
        <div className={`grid gap-3 ${isMobileLandscape ? "mt-3 grid-cols-2 items-start" : "mt-4 grid-cols-1"}`}>
          <div className="grid content-start gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] font-medium text-gold-soft">本局</div>
            {isMultiplayer && room ? (
              <div className="mb-1 flex items-center justify-between rounded-lg border border-gold/20 bg-gold/10 px-2.5 py-2 text-xs">
                <span className="text-slate-300">房间号</span>
                <span className="font-bold tracking-[0.22em] text-gold-soft">{room.code}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>底分</span>
              <span className="font-semibold tabular-nums text-gold-soft">{baseScore}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>买马</span>
              <span className={liangDaoZimoBuyHorseEnabled ? "font-semibold text-jade" : "text-slate-500"}>
                {liangDaoZimoBuyHorseEnabled ? "开启" : "关闭"}
              </span>
            </div>
          </div>

          {isMultiplayer ? (
            <div className="grid content-start gap-3">
              <div className="rounded-lg border border-white/12 bg-slate-900/70 px-3 py-2.5 text-xs text-slate-400">
                底分和亮倒自摸买马由房主创建房间时设置，局内不可修改。
              </div>
            </div>
          ) : (
            <div className="grid content-start gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-300">下局底分</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draftBaseScore}
                  onChange={(event) => setDraftBaseScore(event.target.value)}
                  className={`rounded-lg border border-white/12 bg-slate-900/70 px-3 text-sm font-semibold text-white outline-none transition focus:border-jade/60 focus:ring-1 focus:ring-jade/30 ${
                    isMobileLandscape ? "h-9" : "h-10"
                  }`}
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/12 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-200 transition hover:border-white/20">
                <span>本局亮倒自摸买马</span>
                <input
                  type="checkbox"
                  checked={draftBuyHorseEnabled}
                  onChange={(event) => setDraftBuyHorseEnabled(event.target.checked)}
                  className="h-4 w-4 accent-jade"
                />
              </label>
            </div>
          )}
        </div>

        <div className={`flex justify-end gap-2 ${isMobileLandscape ? "mt-3" : "mt-5"}`}>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-white/12 bg-white/5 px-4 text-xs font-semibold text-slate-200 transition hover:bg-white/12"
          >
            取消
          </button>
          <button
            type="button"
            onClick={saveSettings}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-b from-jade-soft to-jade-deep px-4 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(15,155,117,0.4)] transition hover:brightness-110"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameHUD() {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const wall = useGameStore((state) => state.wall);
  const players = useGameStore((state) => state.players);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const phase = useGameStore((state) => state.phase);
  const logs = useGameStore((state) => state.logs);
  const resetRound = useGameStore((state) => state.resetRound);
  const netRole = useGameStore((state) => state.netRole);
  const netWinds = useGameStore((state) => state.netWinds);
  const leaveRoom = useRoomStore((state) => state.leave);
  const backToHome = useRoomStore((state) => state.backToHome);
  const room = useRoomStore((state) => state.room);
  const sendQuickChat = useRoomStore((state) => state.sendQuickChat);
  const soundEnabled = useUiStore((state) => state.soundEnabled);
  const setSoundEnabled = useUiStore((state) => state.setSoundEnabled);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const [visibleQuickChat, setVisibleQuickChat] = useState<QuickChatMessage | null>(null);
  const lastQuickChatIdRef = useRef<string | null>(null);
  const lastHudControlPointerActionRef = useRef(0);
  const logPanelRef = useRef<HTMLDivElement>(null);

  function handleExit() {
    if (netRole === "single") backToHome();
    else void leaveRoom();
  }

  const human = players.human;
  const drawn = human.hand.find((tile) => tile.id === human.lastDrawnTileId);
  const canSelfHu = phase === "playing" && currentPlayerId === "human" && analyzeWin(human.hand, drawn?.kind, human.melds).isWin;
  const tingOptions = getTingDiscardOptions(human.hand, human.melds);
  const anGangKinds = getAnGangKinds(human.hand);
  const buGangMelds = human.melds.filter(
    (meld) => meld.type === "peng" && human.hand.some((tile) => tile.kind === meld.tiles[0].kind),
  );
  const visibleQuickChatSeat =
    visibleQuickChat && room
      ? quickChatSenderSeat(visibleQuickChat, room.players, players, netWinds)
      : null;

  useEffect(() => {
    const panel = logPanelRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [logs]);

  useEffect(() => {
    const message = room?.quickChat;
    if (!message || lastQuickChatIdRef.current === message.id) return undefined;
    lastQuickChatIdRef.current = message.id;
    setVisibleQuickChat(message);
    const timer = window.setTimeout(() => {
      setVisibleQuickChat((current) => (current?.id === message.id ? null : current));
    }, QUICK_CHAT_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [room?.quickChat]);

  function handleSendQuickChat(message: string) {
    setQuickChatOpen(false);
    void sendQuickChat(message);
  }

  function handleHudControlPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (event.pointerType !== "mouse") event.preventDefault();
  }

  function handleHudControlPointerUp(event: PointerEvent<HTMLButtonElement>, action: () => void) {
    event.stopPropagation();
    if (event.pointerType === "mouse") return;
    lastHudControlPointerActionRef.current = Date.now();
    action();
  }

  function handleHudControlClick(event: MouseEvent<HTMLButtonElement>, action: () => void) {
    event.stopPropagation();
    if (Date.now() - lastHudControlPointerActionRef.current < 650) return;
    action();
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col justify-between ${
        isMobileLandscape
          ? "mobile-landscape-hud"
          : "p-3 sm:p-5"
      }`}
    >
      {netRole !== "single" ? (
        <>
          <SideNameTag player={players.ai_left} side="left" isCurrent={currentPlayerId === "ai_left"} compact={isMobileLandscape} wind={netWinds?.ai_left} />
          <SideNameTag player={players.ai_right} side="right" isCurrent={currentPlayerId === "ai_right"} compact={isMobileLandscape} wind={netWinds?.ai_right} />
        </>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className={`pointer-events-auto flex ${isMobileLandscape ? "flex-col items-start gap-1.5" : "items-start gap-2"}`}>
          <div
            className={`surface-panel flex items-center rounded-xl ${
              isMobileLandscape ? "gap-1 px-2.5 py-1.5" : "gap-2 px-3.5 py-2"
            }`}
          >
            <div className={`flex items-center font-semibold text-bone ${isMobileLandscape ? "gap-1 text-[10px]" : "gap-2 text-sm"}`}>
              <CircleDot className={`${isMobileLandscape ? "h-3 w-3" : "h-4 w-4"} text-jade`} />
              牌墙剩余 <span className="tabular-nums text-gold-soft">{wall.length}</span> 张
            </div>
          </div>
          <div
            className={`flex ${
              isMobileLandscape
                ? "flex-col gap-1.5"
                : "surface-panel items-center gap-2 rounded-xl px-2 py-2"
            }`}
          >
          <button
            type="button"
            onPointerDown={handleHudControlPointerDown}
            onPointerUp={(event) => handleHudControlPointerUp(event, () => setSoundEnabled(!soundEnabled))}
            onClick={(event) => handleHudControlClick(event, () => setSoundEnabled(!soundEnabled))}
            className={`inline-flex items-center justify-center rounded-lg border border-white/12 bg-white/5 transition hover:border-gold/40 hover:bg-white/12 hover:text-gold-soft ${
              soundEnabled ? "text-jade" : "text-slate-400"
            } ${isMobileLandscape ? "surface-panel h-8 w-8" : "h-7 w-7"}`}
            aria-label={soundEnabled ? "关闭音效" : "开启音效"}
            title={soundEnabled ? "关闭音效" : "开启音效"}
          >
            {soundEnabled ? (
              <Volume2 className={isMobileLandscape ? "h-4 w-4" : "h-4 w-4"} />
            ) : (
              <VolumeX className={isMobileLandscape ? "h-4 w-4" : "h-4 w-4"} />
            )}
          </button>
          <button
            type="button"
            onPointerDown={handleHudControlPointerDown}
            onPointerUp={(event) => handleHudControlPointerUp(event, () => setSettingsOpen(true))}
            onClick={(event) => handleHudControlClick(event, () => setSettingsOpen(true))}
            className={`inline-flex items-center justify-center rounded-lg border border-white/12 bg-white/5 text-slate-200 transition hover:border-gold/40 hover:bg-white/12 hover:text-gold-soft ${
              isMobileLandscape ? "surface-panel h-8 w-8" : "h-7 w-7"
            }`}
            aria-label="设置"
            title="设置"
          >
            <Settings className={isMobileLandscape ? "h-4 w-4" : "h-4 w-4"} />
          </button>
          <button
            type="button"
            onPointerDown={handleHudControlPointerDown}
            onPointerUp={(event) => handleHudControlPointerUp(event, () => setConfirmExit(true))}
            onClick={(event) => handleHudControlClick(event, () => setConfirmExit(true))}
            className={`inline-flex items-center justify-center rounded-lg border border-white/12 bg-white/5 text-slate-200 transition hover:border-rose-300/40 hover:bg-rose-400/15 hover:text-rose-200 ${
              isMobileLandscape ? "surface-panel h-8 w-8" : "h-7 w-7"
            }`}
            aria-label="退出到主页"
            title="退出到主页"
          >
            <LogOut className={isMobileLandscape ? "h-4 w-4" : "h-4 w-4"} />
          </button>
          </div>
        </div>

        <div className={`pointer-events-auto grid gap-2 ${isMobileLandscape ? "w-[104px]" : "min-w-[168px]"}`}>
          <div
            className={`surface-panel grid rounded-xl ${
              isMobileLandscape ? "gap-0.5 px-1 py-1.5 text-[10px]" : "gap-1 px-3 py-2.5 text-xs"
            }`}
          >
            {SCORE_PANEL_PLAYER_ORDER.map((playerId) => {
              const player = players[playerId];
              const tone = playerTone(player.id);
              const isCurrent = player.id === currentPlayerId;
              const wind = netRole !== "single" ? netWinds?.[player.id as EngineSeatId] : undefined;
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between rounded-lg px-1.5 py-1 transition ${
                    isMobileLandscape ? "gap-1" : "gap-3"
                  } ${isCurrent ? "bg-gold/12 ring-1 ring-inset ring-gold/30" : ""}`}
                >
                  <span className={`flex min-w-0 items-center gap-1.5 ${isCurrent ? "text-bone" : tone.text}`}>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
                    {player.isLiangDao ? <BadgeCheck className={`${isMobileLandscape ? "h-3 w-3" : "h-3.5 w-3.5"} text-gold`} /> : null}
                    <span className="min-w-0 truncate">{player.name}</span>
                    {wind ? <span className="shrink-0 text-gold-soft/70">·{WIND_LABEL[wind]}</span> : null}
                  </span>
                  <span className={`font-semibold tabular-nums ${scoreClass(player.score)}`}>
                    {player.score > 0 ? `+${player.score}` : player.score}
                  </span>
                </div>
              );
            })}
          </div>
          {netRole === "single" ? (
            <button
              type="button"
              onClick={resetRound}
              className={`surface-panel inline-flex items-center justify-center gap-1.5 rounded-xl px-3 font-semibold text-slate-100 transition hover:border-gold/40 hover:text-gold-soft ${
                isMobileLandscape ? "h-6 text-[10px]" : "h-9 text-xs"
              }`}
            >
              <RotateCcw className={isMobileLandscape ? "h-3 w-3" : "h-4 w-4"} />
              新局
            </button>
          ) : null}
        </div>
      </div>

      {!isMobileLandscape ? (
        <div
          ref={logPanelRef}
          className="surface-panel pointer-events-auto fixed left-1/2 top-16 z-10 max-h-32 w-[calc(100vw-1.5rem)] -translate-x-1/2 space-y-1 overflow-auto rounded-none border-gold/40 p-2 text-xs hud-scrollbar sm:top-3 sm:w-[min(460px,46vw)]"
        >
          {logs.map((log, index) => {
            const { player, body } = parseLog(log, players);
            const isLatest = index === logs.length - 1;
            return (
              <div
                key={`${log}-${index}`}
                className={`flex items-center gap-2 rounded px-1.5 py-1 leading-5 ${isLatest ? "bg-white/8" : ""}`}
              >
                {player ? (
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold ${player.chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${player.dot}`} />
                    {player.name}
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/8 px-1.5 py-0.5 text-[11px] font-medium text-slate-300">
                    系统
                  </span>
                )}
                <span className={eventToneClass(body)}>{body}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <ActionPanel canSelfHu={canSelfHu} anGangKinds={anGangKinds} buGangMelds={buGangMelds} tingOptions={tingOptions} />
      {netRole !== "single" ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setQuickChatOpen((open) => !open);
            }}
            className={`surface-panel pointer-events-auto fixed z-30 inline-flex items-center justify-center rounded-xl text-slate-100 transition hover:border-jade/45 hover:text-jade-soft ${
              isMobileLandscape
                ? "bottom-[4.05rem] left-[max(0.6rem,env(safe-area-inset-left))] h-9 w-9"
                : "bottom-[8.7rem] left-4 h-11 w-11 sm:left-6"
            } ${quickChatOpen ? "border-jade/45 text-jade-soft" : ""}`}
            aria-label="快捷聊天"
            title="快捷聊天"
          >
            <MessageCircle className={isMobileLandscape ? "h-4 w-4" : "h-5 w-5"} />
          </button>
          {quickChatOpen ? <QuickChatPanel compact={isMobileLandscape} onSend={handleSendQuickChat} /> : null}
          {visibleQuickChat && visibleQuickChatSeat ? (
            <QuickChatBubble
              message={visibleQuickChat}
              seat={visibleQuickChatSeat}
              compact={isMobileLandscape}
            />
          ) : null}
        </>
      ) : null}
      {settingsOpen ? <SettingsModal onClose={() => setSettingsOpen(false)} /> : null}
      {confirmExit ? (
        <div className={`pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm ${isMobileLandscape ? "p-2" : "p-4"}`}>
          <div className={`surface-modal w-full overflow-y-auto rounded-2xl text-sm text-slate-100 hud-scrollbar ${
            isMobileLandscape ? "max-h-[calc(100dvh-1rem)] max-w-[min(360px,calc(100vw-1rem))] p-3" : "max-w-xs p-5"
          }`}>
            <div className="text-base font-semibold text-bone">退出到主页</div>
            <div className="mt-2 text-xs text-slate-400">
              {netRole === "single"
                ? "确定要结束当前对局返回主页吗？"
                : "确定要离开房间返回主页吗？" + (netRole === "host" ? "你是房主，离开将解散整个房间。" : "")}
            </div>
            <div className={`flex justify-end gap-2 ${isMobileLandscape ? "mt-3" : "mt-5"}`}>
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-white/12 bg-white/5 px-4 text-xs font-semibold text-slate-200 transition hover:bg-white/12"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleExit}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-b from-rose-400 to-rose-600 px-4 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(244,63,94,0.4)] transition hover:brightness-110"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
