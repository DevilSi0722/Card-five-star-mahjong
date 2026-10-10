import type { Player, TileInstance } from "@/types/mahjong";
import type { EngineSeatId, NetGameSnapshot, NetGameView } from "@/types/multiplayer";

export const SYNC_PROTOCOL = 2;
const seats: EngineSeatId[] = ["human", "ai_right", "ai_left"];
type CompactPlayer = Omit<Player, "hand"> & { hand: TileInstance[] | number };
type CompactFields = Omit<NetGameSnapshot, "wall" | "deadWall" | "players"> & {
  wallCount: number;
  deadWallCount: number;
};
export type CompactState = CompactFields & { players: Record<EngineSeatId, CompactPlayer> };
export type CompactView = Omit<NetGameView, "state"> & { state: CompactState };
type Metadata = Omit<CompactView, "state">;
export type GameSyncPacket = Metadata & (
  | { kind: "full"; state: CompactState }
  | { kind: "patch"; baseRev: number; changes: Partial<CompactFields>;
      removed: (keyof CompactFields)[]; players: Partial<Record<EngineSeatId, CompactPlayer>> }
);

/** 同一次碰杠胡响应窗口内，其他人的「过」不会让合法操作过期。 */
export function actionContext(state: NetGameSnapshot, round: number): string {
  if (state.phase === "responding" && state.pendingReactions) {
    return `${round}:reaction:${state.pendingReactions.discard.tile.id}`;
  }
  return `${round}:${state.phase}:${state.currentPlayerId}:${state.actionNonce}`;
}

const hidden = (id: string): TileInstance => ({ id, suit: "dot", rank: 1, kind: "dot-1", copy: 0 });
const hiddenTiles = (count: number, prefix: string) => Array.from({ length: count }, (_, i) => hidden(`${prefix}:${i}`));

export function compactView(view: NetGameView): CompactView {
  const { wall, deadWall, players, ...fields } = view.state;
  const compactPlayers = {} as CompactState["players"];
  for (const seat of seats) {
    const player = players[seat];
    compactPlayers[seat] = {
      ...player,
      hand: player.hand.every((tile) => tile.id.startsWith("hidden:")) ? player.hand.length : player.hand,
    };
  }
  // Match JSON wire semantics now, including omitted optional fields, so patches can clear them.
  return JSON.parse(JSON.stringify({ ...view, state: {
    ...fields, players: compactPlayers, wallCount: wall.length, deadWallCount: deadWall.length,
  } })) as CompactView;
}

export function expandView(view: CompactView): NetGameView {
  const { wallCount, deadWallCount, players, ...fields } = view.state;
  const expanded = {} as NetGameSnapshot["players"];
  for (const seat of seats) {
    const player = players[seat];
    expanded[seat] = { ...player, hand: typeof player.hand === "number"
      ? hiddenTiles(player.hand, `hidden:${seat}:hand`) : player.hand };
  }
  return { ...view, state: {
    ...fields, players: expanded,
    wall: hiddenTiles(wallCount, `hidden:${view.forSeat}:wall`),
    deadWall: hiddenTiles(deadWallCount, `hidden:${view.forSeat}:dead`),
  } };
}

export function syncPacket(next: CompactView, previous?: CompactView): GameSyncPacket {
  const { state, ...metadata } = next;
  const full: GameSyncPacket = { ...metadata, kind: "full", state };
  if (!previous || previous.round !== next.round || previous.forSeat !== next.forSeat
    || previous.roomCode !== next.roomCode) return full;
  const { players, ...fields } = state;
  const { players: oldPlayers, ...oldFields } = previous.state;
  const changes: Partial<CompactFields> = {};
  const removed: (keyof CompactFields)[] = [];
  for (const key of Object.keys(fields) as (keyof CompactFields)[]) {
    if (JSON.stringify(fields[key]) !== JSON.stringify(oldFields[key])) {
      (changes as Record<string, unknown>)[key] = fields[key];
    }
  }
  for (const key of Object.keys(oldFields) as (keyof CompactFields)[]) {
    if (!(key in fields)) removed.push(key);
  }
  const playerChanges: Partial<Record<EngineSeatId, CompactPlayer>> = {};
  for (const seat of seats) {
    if (JSON.stringify(players[seat]) !== JSON.stringify(oldPlayers[seat])) playerChanges[seat] = players[seat];
  }
  const patch: GameSyncPacket = { ...metadata, kind: "patch", baseRev: previous.rev, changes, removed, players: playerChanges };
  return JSON.stringify(patch).length < JSON.stringify(full).length ? patch : full;
}

/** undefined means the baseline was missed; request a full view instead of applying a partial state. */
export function applySyncPacket(previous: CompactView | undefined, packet: GameSyncPacket): CompactView | undefined {
  if (packet.kind === "full") {
    const { kind: _kind, ...view } = packet;
    return view;
  }
  if (!previous || previous.rev !== packet.baseRev || previous.round !== packet.round
    || previous.forSeat !== packet.forSeat || previous.roomCode !== packet.roomCode) return undefined;
  const { kind: _kind, baseRev: _baseRev, changes, removed, players, ...metadata } = packet;
  const state = { ...previous.state, ...changes, players: { ...previous.state.players, ...players } };
  for (const key of removed) delete (state as Record<string, unknown>)[key];
  return { ...metadata, state };
}
