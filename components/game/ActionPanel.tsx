"use client";

import { Check, Eye, HandMetal, Octagon, Shield, X } from "lucide-react";
import type { Meld, TileKind } from "@/types/mahjong";
import { useGameStore } from "@/store/gameStore";
import { useResponsiveGameLayout } from "@/hooks/useResponsiveGameLayout";
import { TILE_KIND_LABEL } from "@/utils/mahjong/tiles";

interface ActionPanelProps {
  canSelfHu: boolean;
  anGangKinds: TileKind[];
  buGangMelds: Meld[];
  tingOptions: Array<{ discardTileId: string; discardKind: TileKind; waits: TileKind[] }>;
}

function ActionButton({
  label,
  icon,
  children,
  onClick,
  tone = "default",
  compact = false,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "primary" | "danger";
  compact?: boolean;
}) {
  const toneClass =
    tone === "primary"
      ? "border-emerald-300/45 bg-emerald-400/22 text-emerald-50 hover:bg-emerald-400/32"
      : tone === "danger"
        ? "border-rose-300/45 bg-rose-400/22 text-rose-50 hover:bg-rose-400/32"
        : "border-white/15 bg-slate-950/72 text-slate-50 hover:bg-white/16";

  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`group flex shrink-0 flex-col items-center justify-center rounded-full border-2 font-bold leading-none shadow-panel backdrop-blur-md transition active:scale-95 ${
        compact ? "h-14 w-14 text-[11px]" : "h-20 w-20 text-sm sm:h-24 sm:w-24 sm:text-base"
      } ${toneClass}`}
    >
      <span
        className={`flex items-center justify-center ${
          compact
            ? "mb-0.5 h-5 w-5 [&>svg]:h-5 [&>svg]:w-5"
            : "mb-1.5 h-7 w-7 sm:h-8 sm:w-8 [&>svg]:h-7 [&>svg]:w-7 sm:[&>svg]:h-8 sm:[&>svg]:w-8"
        }`}
      >
        {icon}
      </span>
      {children}
    </button>
  );
}

export function ActionPanel({ canSelfHu, anGangKinds, buGangMelds, tingOptions }: ActionPanelProps) {
  const { isMobileLandscape } = useResponsiveGameLayout();
  const phase = useGameStore((state) => state.phase);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const selectedTileId = useGameStore((state) => state.selectedTileId);
  const pendingReactions = useGameStore((state) => state.pendingReactions);
  const reactionPasses = useGameStore((state) => state.reactionPasses);
  const players = useGameStore((state) => state.players);
  const declareLiangDao = useGameStore((state) => state.declareLiangDao);
  const claimHu = useGameStore((state) => state.claimHu);
  const claimPeng = useGameStore((state) => state.claimPeng);
  const claimMingGang = useGameStore((state) => state.claimMingGang);
  const claimAnGang = useGameStore((state) => state.claimAnGang);
  const claimBuGang = useGameStore((state) => state.claimBuGang);
  const passReaction = useGameStore((state) => state.passReaction);

  const human = players.human;
  const isHumanTurn = phase === "playing" && currentPlayerId === "human";
  const playable = isHumanTurn && !human.autoPlay;
  const canClaimSelfHu = isHumanTurn && canSelfHu;
  const selectedTingOption = selectedTileId
    ? tingOptions.find((option) => option.discardTileId === selectedTileId)
    : tingOptions[0];
  const humanReaction =
    phase === "responding" && pendingReactions
      ? (
          pendingReactions.options.find((option) => !reactionPasses.includes(option.playerId) && option.canHu) ??
          pendingReactions.options.find((option) => !reactionPasses.includes(option.playerId) && option.canGang) ??
          pendingReactions.options.find((option) => !reactionPasses.includes(option.playerId) && option.canPeng)
        )?.playerId === "human"
      ? pendingReactions.options.find((option) => option.playerId === "human")
      : undefined
      : undefined;

  const rightActions: React.ReactNode[] = [];

  if (humanReaction?.canPeng) {
    rightActions.push(
      <ActionButton compact={isMobileLandscape} key="peng" label="碰" icon={<HandMetal />} onClick={() => claimPeng("human")}>
        碰
      </ActionButton>,
    );
  }

  if (humanReaction?.canGang) {
    rightActions.push(
      <ActionButton compact={isMobileLandscape} key="ming-gang" label="杠" icon={<Octagon />} onClick={() => claimMingGang("human")}>
        杠
      </ActionButton>,
    );
  }

  if (playable) {
    for (const kind of anGangKinds.slice(0, 2)) {
      rightActions.push(
        <ActionButton
          key={`an-gang-${kind}`}
          label={`暗杠 ${TILE_KIND_LABEL[kind]}`}
          icon={<Octagon />}
          onClick={() => claimAnGang("human", kind)}
          compact={isMobileLandscape}
        >
          暗杠
        </ActionButton>,
      );
    }

    for (const meld of buGangMelds.slice(0, 2)) {
      rightActions.push(
        <ActionButton
          key={meld.id}
          label={`补杠 ${TILE_KIND_LABEL[meld.tiles[0].kind]}`}
          icon={<Shield />}
          onClick={() => claimBuGang("human", meld.id)}
          compact={isMobileLandscape}
        >
          补杠
        </ActionButton>,
      );
    }
  }

  if (humanReaction?.canHu) {
    rightActions.unshift(
      <ActionButton compact={isMobileLandscape} key="hu" tone="primary" label="胡" icon={<Check />} onClick={() => claimHu("human")}>
        胡
      </ActionButton>,
    );
  }

  if (humanReaction) {
    rightActions.push(
      <ActionButton compact={isMobileLandscape} key="pass" tone="danger" label="过" icon={<X />} onClick={() => passReaction("human")}>
        过
      </ActionButton>,
    );
  }

  if (canClaimSelfHu) {
    rightActions.unshift(
      <ActionButton compact={isMobileLandscape} key="zimo" tone="primary" label="自摸" icon={<Check />} onClick={() => claimHu("human")}>
        自摸
      </ActionButton>,
    );
  }

  if (playable && selectedTingOption) {
    rightActions.unshift(
      <ActionButton
        key="liang-dao"
        label="亮倒"
        icon={<Eye />}
        onClick={() => declareLiangDao("human", selectedTingOption.discardTileId)}
        compact={isMobileLandscape}
      >
        亮倒
      </ActionButton>,
    );
  }

  return (
    rightActions.length > 0 ? (
      <div
        className={`pointer-events-auto fixed z-40 flex items-center justify-center ${
          isMobileLandscape
            ? "mobile-landscape-actions top-1/2 max-h-[calc(100dvh-1rem)] -translate-y-1/2 flex-col gap-2 overflow-y-auto"
            : "bottom-[168px] left-1/2 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-row flex-wrap gap-3 sm:bottom-[188px]"
        }`}
      >
        {rightActions}
      </div>
    ) : null
  );
}
