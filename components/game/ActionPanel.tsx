"use client";

import type { Meld, TileKind } from "@/types/mahjong";
import { useGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { TILE_KIND_LABEL } from "@/utils/mahjong/tiles";

interface ActionPanelProps {
  canSelfHu: boolean;
  anGangKinds: TileKind[];
  buGangMelds: Meld[];
  tingOptions: Array<{ discardTileId: string; discardKind: TileKind; waits: TileKind[] }>;
}

type ActionButtonVariant = "winner" | "peng" | "gang" | "liangdao";

function ActionButton({
  label,
  children,
  onClick,
  tone = "default",
  compact = false,
  variant = "winner",
  pressed = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "primary" | "danger";
  compact?: boolean;
  variant?: ActionButtonVariant;
  pressed?: boolean;
}) {
  const isPass = label === "过";
  const isProminent = !isPass;
  const prominentToneClass: Record<ActionButtonVariant, string> = {
    winner:
      "action-call-button action-call-button--winner border-gold/75 bg-gradient-to-b from-[#3a2d13]/95 via-[#161b20]/95 to-[#070b12]/95 text-gold-soft shadow-[0_16px_34px_rgba(0,0,0,0.48),0_0_20px_rgba(233,196,106,0.34),inset_0_1px_0_rgba(255,255,255,0.18)] hover:border-gold hover:text-gold",
    peng:
      "action-call-button action-call-button--peng border-emerald-200/70 bg-gradient-to-b from-[#12362b]/95 via-[#0d261f]/95 to-[#06100d]/95 text-emerald-100 shadow-[0_16px_34px_rgba(0,0,0,0.48),0_0_20px_rgba(45,212,140,0.34),inset_0_1px_0_rgba(255,255,255,0.18)] hover:border-emerald-100 hover:text-emerald-50",
    gang:
      "action-call-button action-call-button--gang border-violet-200/70 bg-gradient-to-b from-[#2b1b4b]/95 via-[#1d1432]/95 to-[#0b0714]/95 text-violet-100 shadow-[0_16px_34px_rgba(0,0,0,0.48),0_0_20px_rgba(139,92,246,0.36),inset_0_1px_0_rgba(255,255,255,0.18)] hover:border-violet-100 hover:text-violet-50",
    liangdao:
      "action-call-button action-call-button--liangdao border-sky-200/70 bg-gradient-to-b from-[#0b3147]/95 via-[#0a2233]/95 to-[#04101a]/95 text-sky-100 shadow-[0_16px_34px_rgba(0,0,0,0.48),0_0_20px_rgba(56,189,248,0.34),inset_0_1px_0_rgba(255,255,255,0.18)] hover:border-sky-100 hover:text-sky-50",
  };
  const toneClass =
    isProminent
      ? prominentToneClass[variant]
      : tone === "primary"
        ? "border-gold/70 bg-gradient-to-b from-slate-900/90 to-slate-950/90 text-gold-soft shadow-[0_10px_26px_rgba(233,196,106,0.4),0_0_16px_rgba(233,196,106,0.35)] hover:border-gold hover:text-gold"
        : tone === "danger"
          ? "border-rose-300/50 bg-gradient-to-b from-rose-400/35 to-rose-600/35 text-rose-50 hover:brightness-110"
          : "border-white/20 bg-gradient-to-b from-slate-800/85 to-slate-950/85 text-slate-50 hover:border-white/35 hover:from-slate-700/85";
  const sizeClass = compact
    ? isPass
      ? "h-11 w-11 text-xl"
      : "h-[68px] w-[68px] text-[2.35rem]"
    : isPass
      ? "h-16 w-16 text-2xl sm:h-[72px] sm:w-[72px] sm:text-3xl"
      : "h-[76px] w-[76px] text-[2.7rem] sm:h-[84px] sm:w-[84px] sm:text-[3rem]";

  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`group flex shrink-0 flex-col items-center justify-center rounded-full border-2 font-bold leading-none shadow-panel backdrop-blur-md transition active:scale-90 ${
        sizeClass
      } ${isProminent ? "tracking-normal" : ""} ${pressed ? "action-call-button--pressed" : ""} ${toneClass}`}
    >
      {children}
    </button>
  );
}

export function ActionPanel({ canSelfHu, anGangKinds, buGangMelds, tingOptions }: ActionPanelProps) {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const phase = useGameStore((state) => state.phase);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const pendingReactions = useGameStore((state) => state.pendingReactions);
  const reactionPasses = useGameStore((state) => state.reactionPasses);
  const players = useGameStore((state) => state.players);
  const claimHu = useGameStore((state) => state.claimHu);
  const claimPeng = useGameStore((state) => state.claimPeng);
  const claimMingGang = useGameStore((state) => state.claimMingGang);
  const claimAnGang = useGameStore((state) => state.claimAnGang);
  const claimBuGang = useGameStore((state) => state.claimBuGang);
  const discardTile = useGameStore((state) => state.discardTile);
  const passReaction = useGameStore((state) => state.passReaction);
  const liangDaoArmed = useUiStore((state) => state.liangDaoArmed);
  const setLiangDaoArmed = useUiStore((state) => state.setLiangDaoArmed);

  const human = players.human;
  const isHumanTurn = phase === "playing" && currentPlayerId === "human";
  const playable = isHumanTurn && !human.autoPlay;
  const liangDaoDecisionTurn = isHumanTurn && human.isLiangDao;
  const canClaimSelfHu = isHumanTurn && canSelfHu;
  const drawnTile = human.lastDrawnTileId ? human.hand.find((tile) => tile.id === human.lastDrawnTileId) : undefined;
  const remainingReactions =
    phase === "responding" && pendingReactions
      ? pendingReactions.options.filter((option) => !reactionPasses.includes(option.playerId))
      : [];
  const humanPendingReaction = remainingReactions.find((option) => option.playerId === "human");
  const hasHuPriority = remainingReactions.some((option) => option.canHu);
  const topNonHuReaction =
    remainingReactions.find((option) => option.canGang) ?? remainingReactions.find((option) => option.canPeng);
  const humanReaction = humanPendingReaction?.canHu
    ? humanPendingReaction
    : !hasHuPriority && topNonHuReaction?.playerId === "human"
      ? humanPendingReaction
      : undefined;

  const rightActions: React.ReactNode[] = [];
  const turnAnGangKinds = liangDaoDecisionTurn && drawnTile
    ? anGangKinds.filter((kind) => kind === drawnTile.kind)
    : anGangKinds;
  const turnBuGangMelds = buGangMelds;
  const showTurnGangActions = playable || (liangDaoDecisionTurn && !canClaimSelfHu);

  if (humanReaction?.canPeng) {
    rightActions.push(
      <ActionButton compact={isMobileLandscape} key="peng" label="碰" variant="peng" onClick={() => claimPeng("human")}>
        碰
      </ActionButton>,
    );
  }

  if (humanReaction?.canGang) {
    rightActions.push(
      <ActionButton compact={isMobileLandscape} key="ming-gang" label="杠" variant="gang" onClick={() => claimMingGang("human")}>
        杠
      </ActionButton>,
    );
  }

  if (showTurnGangActions) {
    for (const kind of turnAnGangKinds.slice(0, 2)) {
      rightActions.push(
        <ActionButton
          key={`an-gang-${kind}`}
          label={`暗杠 ${TILE_KIND_LABEL[kind]}`}
          onClick={() => claimAnGang("human", kind)}
          compact={isMobileLandscape}
          variant="gang"
        >
          杠
        </ActionButton>,
      );
    }

    for (const meld of turnBuGangMelds.slice(0, 2)) {
      rightActions.push(
        <ActionButton
          key={meld.id}
          label={`补杠 ${TILE_KIND_LABEL[meld.tiles[0].kind]}`}
          onClick={() => claimBuGang("human", meld.id)}
          compact={isMobileLandscape}
          variant="gang"
        >
          杠
        </ActionButton>,
      );
    }

    if (liangDaoDecisionTurn && drawnTile && (turnAnGangKinds.length > 0 || turnBuGangMelds.length > 0)) {
      rightActions.push(
        <ActionButton
          compact={isMobileLandscape}
          key="skip-liang-dao-gang"
          tone="danger"
          label="过"
          onClick={() => discardTile("human", drawnTile.id)}
        >
          过
        </ActionButton>,
      );
    }
  }

  if (humanReaction?.canHu) {
    rightActions.unshift(
      <ActionButton compact={isMobileLandscape} key="hu" tone="primary" label="胡" onClick={() => claimHu("human")}>
        胡
      </ActionButton>,
    );
  }

  if (humanReaction) {
    rightActions.push(
      <ActionButton compact={isMobileLandscape} key="pass" tone="danger" label="过" onClick={() => passReaction("human")}>
        过
      </ActionButton>,
    );
  }

  if (canClaimSelfHu) {
    rightActions.unshift(
      <ActionButton compact={isMobileLandscape} key="zimo" tone="primary" label="自摸" onClick={() => claimHu("human")}>
        胡
      </ActionButton>,
    );
    rightActions.push(
      <ActionButton compact={isMobileLandscape} key="pass-self-hu" tone="danger" label="过" onClick={() => passReaction("human")}>
        过
      </ActionButton>,
    );
  }

  if (playable && tingOptions.length > 0) {
    rightActions.unshift(
      <ActionButton
        key="liang-dao"
        tone={liangDaoArmed ? "primary" : "default"}
        label="亮倒"
        onClick={() => setLiangDaoArmed(!liangDaoArmed)}
        compact={isMobileLandscape}
        variant="liangdao"
        pressed={liangDaoArmed}
      >
        亮
      </ActionButton>,
    );
  }

  return (
    rightActions.length > 0 ? (
      <div
        className={`pointer-events-auto fixed z-40 flex items-center justify-center ${
          isMobileLandscape
            ? "mobile-landscape-actions max-w-[min(520px,calc(100vw-12rem))] flex-row flex-wrap gap-3 overflow-visible"
            : "bottom-[168px] left-1/2 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-row flex-wrap gap-3 sm:bottom-[188px]"
        }`}
      >
        {rightActions}
      </div>
    ) : null
  );
}
