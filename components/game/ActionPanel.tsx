"use client";

import { Check, Eye, HandMetal, Octagon, Shield, X } from "lucide-react";
import type { Meld, TileKind } from "@/types/mahjong";
import { useGameStore } from "@/store/gameStore";
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
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "primary" | "danger";
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
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`group flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-2 text-sm font-bold leading-none shadow-panel backdrop-blur-md transition active:scale-95 sm:h-24 sm:w-24 sm:text-base ${toneClass}`}
    >
      <span className="mb-1.5 flex h-7 w-7 items-center justify-center sm:h-8 sm:w-8">{icon}</span>
      {children}
    </button>
  );
}

export function ActionPanel({ canSelfHu, anGangKinds, buGangMelds, tingOptions }: ActionPanelProps) {
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
      <ActionButton key="peng" label="碰" icon={<HandMetal className="h-7 w-7 sm:h-8 sm:w-8" />} onClick={() => claimPeng("human")}>
        碰
      </ActionButton>,
    );
  }

  if (humanReaction?.canGang) {
    rightActions.push(
      <ActionButton key="ming-gang" label="杠" icon={<Octagon className="h-7 w-7 sm:h-8 sm:w-8" />} onClick={() => claimMingGang("human")}>
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
          icon={<Octagon className="h-7 w-7 sm:h-8 sm:w-8" />}
          onClick={() => claimAnGang("human", kind)}
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
          icon={<Shield className="h-7 w-7 sm:h-8 sm:w-8" />}
          onClick={() => claimBuGang("human", meld.id)}
        >
          补杠
        </ActionButton>,
      );
    }
  }

  if (humanReaction?.canHu) {
    rightActions.unshift(
      <ActionButton key="hu" tone="primary" label="胡" icon={<Check className="h-7 w-7 sm:h-8 sm:w-8" />} onClick={() => claimHu("human")}>
        胡
      </ActionButton>,
    );
  }

  if (humanReaction) {
    rightActions.push(
      <ActionButton key="pass" tone="danger" label="过" icon={<X className="h-7 w-7 sm:h-8 sm:w-8" />} onClick={() => passReaction("human")}>
        过
      </ActionButton>,
    );
  }

  if (canClaimSelfHu) {
    rightActions.unshift(
      <ActionButton key="zimo" tone="primary" label="自摸" icon={<Check className="h-7 w-7 sm:h-8 sm:w-8" />} onClick={() => claimHu("human")}>
        自摸
      </ActionButton>,
    );
  }

  if (playable && selectedTingOption) {
    rightActions.unshift(
      <ActionButton
        key="liang-dao"
        label="亮倒"
        icon={<Eye className="h-7 w-7 sm:h-8 sm:w-8" />}
        onClick={() => declareLiangDao("human", selectedTingOption.discardTileId)}
      >
        亮倒
      </ActionButton>,
    );
  }

  return (
    rightActions.length > 0 ? (
      <div className="pointer-events-auto fixed bottom-5 right-5 z-20 flex max-w-[12rem] flex-row-reverse flex-wrap items-end justify-end gap-3 sm:max-w-[14rem]">
        {rightActions}
      </div>
    ) : null
  );
}
