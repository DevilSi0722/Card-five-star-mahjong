"use client";

import { create } from "zustand";
import type {
  GameState,
  LastDiscard,
  Meld,
  Player,
  PlayerId,
  ReactionOption,
  ScoreResult,
  TileInstance,
  TileKind,
  WinMethod,
  WinResult,
} from "@/types/mahjong";
import { createTileSet, sortTiles, TILE_KIND_LABEL } from "@/utils/mahjong/tiles";
import { shuffle } from "@/utils/mahjong/shuffle";
import { BASE_SCORE, getNextPlayerId, getPlayersAfter, INITIAL_SCORE } from "@/utils/mahjong/rules";
import {
  analyzeWin,
  getAnGangKinds,
  getTingDiscardOptions,
  getWinningKinds,
} from "@/utils/mahjong/handAnalyzer";
import { applyGangScore, scoreDraw, scoreGang, scoreWin } from "@/utils/mahjong/scoring";
import { getForbiddenDiscards } from "@/utils/mahjong/ai";
import type {
  EngineSeatId,
  GuestActionInput,
  NetGameSnapshot,
  NetRole,
  Wind,
} from "@/types/multiplayer";

interface GameStore extends GameState {
  /** 联机角色：single（单机）/ host（房主跑引擎）/ guest（访客渲染视图）。 */
  netRole: NetRole;
  /** 本客户端的真实引擎座位（host 恒为 human）。 */
  netSeat: EngineSeatId;
  /** 各显示座位（human/ai_right/ai_left）对应的风位标签，用于在玩家名下显示风位。 */
  netWinds?: Record<EngineSeatId, Wind>;
  /** host 端持久保存的座位名册（区分真人/AI），每局发牌后重新套用。 */
  netRoster?: Partial<Record<EngineSeatId, { name: string; isAi: boolean }>>;
  /** guest 发起动作时的转发回调，由对局桥接层注入；host/single 为 undefined。 */
  netForward?: (action: GuestActionInput) => void;
  /** 配置联机角色与转发回调。 */
  configureNet: (config: { role: NetRole; seat: EngineSeatId; forward?: (action: GuestActionInput) => void }) => void;
  /** 单独校正本客户端的引擎座位（访客在三人就座、座位推导出来后调用）。 */
  setNetSeat: (seat: EngineSeatId) => void;
  /** 设置各显示座位的风位标签。 */
  setNetWinds: (winds: Record<EngineSeatId, Wind>) => void;
  /** guest 用收到的房主视图快照覆盖本地渲染状态。 */
  applyNetSnapshot: (snapshot: NetGameSnapshot) => void;
  /** host 按房间名册修正各座位的玩家类型与昵称（真人座位 type=human，AI 座位 type=ai）。 */
  applyNetRoster: (roster: Partial<Record<EngineSeatId, { name: string; isAi: boolean }>>) => void;
  setNextLiangDaoZimoBuyHorseEnabled: (enabled: boolean) => void;
  saveNextRoundSettings: (settings: { baseScore: number; liangDaoZimoBuyHorseEnabled: boolean }) => void;
  startNewRound: () => void;
  shuffleWall: () => void;
  dealInitialHands: () => void;
  drawTile: (playerId: PlayerId) => void;
  discardTile: (playerId: PlayerId, tileId: string) => void;
  selectTile: (tileId?: string) => void;
  passReaction: (playerId: PlayerId) => void;
  claimPeng: (playerId: PlayerId) => void;
  claimMingGang: (playerId: PlayerId) => void;
  claimAnGang: (playerId: PlayerId, tileType: TileKind) => void;
  claimBuGang: (playerId: PlayerId, meldId: string) => void;
  declareLiangDao: (playerId: PlayerId, discardTileId: string) => void;
  claimHu: (playerId: PlayerId) => void;
  resolveReactions: () => void;
  nextTurn: (delayMs?: number) => void;
  settleWin: (winnerId: PlayerId, method: WinMethod, loserId?: PlayerId, winningTile?: TileInstance) => void;
  settleWins: (winnerIds: PlayerId[], method: WinMethod, loserId: PlayerId, winningTile: TileInstance) => void;
  settleNoSafeDiscard: (playerId: PlayerId) => void;
  resetRound: () => void;
}

const PLAYER_NAMES: Record<PlayerId, string> = {
  human: "你",
  ai_left: "左家 AI",
  ai_right: "右家 AI",
};

function createPlayers(previous?: Record<PlayerId, Player>, dealerId: PlayerId = "human"): Record<PlayerId, Player> {
  return {
    human: createPlayer("human", "human", "bottom", dealerId === "human", previous?.human.score),
    ai_left: createPlayer("ai_left", "ai", "left", dealerId === "ai_left", previous?.ai_left.score),
    ai_right: createPlayer("ai_right", "ai", "right", dealerId === "ai_right", previous?.ai_right.score),
  };
}

function createPlayer(
  id: PlayerId,
  type: Player["type"],
  seat: Player["seat"],
  isDealer: boolean,
  score = INITIAL_SCORE,
): Player {
  return {
    id,
    type,
    name: PLAYER_NAMES[id],
    seat,
    hand: [],
    discards: [],
    melds: [],
    score,
    isDealer,
    isLiangDao: false,
    autoPlay: false,
    waitingKinds: [],
  };
}

function pushLog(logs: string[], message: string): string[] {
  return [...logs, message].slice(-8);
}

function removeTilesByKind(hand: TileInstance[], kind: TileKind, count: number): TileInstance[] {
  const removed: TileInstance[] = [];
  const remaining: TileInstance[] = [];
  for (const tile of hand) {
    if (tile.kind === kind && removed.length < count) removed.push(tile);
    else remaining.push(tile);
  }
  return remaining;
}

function takeTilesByKind(hand: TileInstance[], kind: TileKind, count: number): TileInstance[] {
  return hand.filter((tile) => tile.kind === kind).slice(0, count);
}

/**
 * 是否为「非基础胡」：除基础胡外还成立任意番型（碰碰胡/清一色/七对/大小三元/卡五星）。
 * 基础听牌（只有基础胡，无额外番型）在点炮规则中受限。
 */
function isNonBasicWin(win: WinResult): boolean {
  return Boolean(
    win.isPengPengHu ||
      win.isMingSiGuiYi ||
      win.isAnSiGuiYi ||
      win.isQingYiSe ||
      win.isSevenPairs ||
      win.isDaSanYuan ||
      win.isXiaoSanYuan ||
      win.isKaWuXing ||
      win.isShouZhuaYi,
  );
}

function buildReactionOptions(
  players: Record<PlayerId, Player>,
  discard: LastDiscard,
): ReactionOption[] {
  const discarder = players[discard.playerId];
  return getPlayersAfter(discard.playerId)
    .map((playerId) => {
      const player = players[playerId];
      const sameCount = player.hand.filter((tile) => tile.kind === discard.tile.kind).length;
      const win = analyzeWin([...player.hand, discard.tile], discard.tile.kind, player.melds);
      // 点炮胡限制：若胡牌方仅为基础胡，且打出者未亮倒，则不能点炮胡。
      // 仅当胡的是非基础胡，或打出者处于亮倒状态时，才允许点炮。
      const canHu = win.isWin && (isNonBasicWin(win) || discarder.isLiangDao);
      const canPeng = !player.isLiangDao && sameCount >= 2;
      const canGang = !player.isLiangDao && sameCount >= 3;
      return { playerId, canHu, canPeng, canGang };
    })
    .filter((option) => option.canHu || option.canGang || option.canPeng);
}

function topPriorityReaction(
  pending: NonNullable<GameState["pendingReactions"]>,
  passes: PlayerId[],
) {
  const remaining = pending.options.filter((option) => !passes.includes(option.playerId));
  return (
    remaining.find((option) => option.canHu) ??
    remaining.find((option) => option.canGang) ??
    remaining.find((option) => option.canPeng)
  );
}

function pendingHuPlayerIds(
  pending: NonNullable<GameState["pendingReactions"]>,
  passes: PlayerId[],
): PlayerId[] {
  return pending.options
    .filter((option) => option.canHu && !passes.includes(option.playerId))
    .map((option) => option.playerId);
}

function applyRoundResult(
  players: Record<PlayerId, Player>,
  result: ScoreResult,
): Record<PlayerId, Player> {
  return {
    human: { ...players.human, score: result.totalScores.human },
    ai_left: { ...players.ai_left, score: result.totalScores.ai_left },
    ai_right: { ...players.ai_right, score: result.totalScores.ai_right },
  };
}

function playerScores(players: Record<PlayerId, Player>): Record<PlayerId, number> {
  return {
    human: players.human.score,
    ai_left: players.ai_left.score,
    ai_right: players.ai_right.score,
  };
}

function emptyRoundScoreNotes(): Record<PlayerId, string[]> {
  return {
    human: [],
    ai_left: [],
    ai_right: [],
  };
}

function appendScoreNotes(
  notes: Record<PlayerId, string[]>,
  scoreChanges: Record<PlayerId, number>,
  positiveLabel: string,
  negativeLabel: string,
): Record<PlayerId, string[]> {
  return {
    human: appendScoreNote(notes.human, scoreChanges.human, positiveLabel, negativeLabel),
    ai_left: appendScoreNote(notes.ai_left, scoreChanges.ai_left, positiveLabel, negativeLabel),
    ai_right: appendScoreNote(notes.ai_right, scoreChanges.ai_right, positiveLabel, negativeLabel),
  };
}

function appendScoreNote(notes: string[], change: number, positiveLabel: string, negativeLabel: string): string[] {
  if (change > 0) return [...notes, `${positiveLabel}+${change}`];
  if (change < 0) return [...notes, `${negativeLabel}${change}`];
  return notes;
}

function fanNoteName(name: string): string {
  return name === "亮倒/明牌" ? "亮倒" : name;
}

function winPayerLabel(method: WinMethod): string {
  if (method === "discard") return "点炮";
  if (method === "qianggang") return "被抢杠";
  if (method === "gangshang") return "杠开";
  return "自摸";
}

function appendWinScoreNotes(
  notes: Record<PlayerId, string[]>,
  result: ScoreResult,
): Record<PlayerId, string[]> {
  if (!result.winnerId || !result.method) return notes;
  const next = {
    human: [...notes.human],
    ai_left: [...notes.ai_left],
    ai_right: [...notes.ai_right],
  };
  const fanNotes = result.fans.map((item) => `${fanNoteName(item.name)}*${item.fan}`);
  next[result.winnerId].push(...fanNotes);

  const payerLabel = winPayerLabel(result.method);
  for (const id of Object.keys(result.scoreChanges) as PlayerId[]) {
    const change = result.scoreChanges[id];
    if (change < 0) {
      next[id].push(`${payerLabel}${change}`);
    }
  }
  return next;
}

function appendBuyHorseScoreNotes(
  notes: Record<PlayerId, string[]>,
  winnerId: PlayerId,
  ids: PlayerId[],
  bonus: number,
): Record<PlayerId, string[]> {
  const next = {
    human: [...notes.human],
    ai_left: [...notes.ai_left],
    ai_right: [...notes.ai_right],
  };
  let total = 0;
  for (const id of ids) {
    if (id === winnerId) continue;
    next[id].push(`买马-${bonus}`);
    total += bonus;
  }
  if (total > 0) next[winnerId].push(`买马+${total}`);
  return next;
}

function normalizeRoundResult(
  result: ScoreResult,
  roundStartScores: Record<PlayerId, number>,
): ScoreResult {
  return {
    ...result,
    scoreChanges: {
      human: result.totalScores.human - roundStartScores.human,
      ai_left: result.totalScores.ai_left - roundStartScores.ai_left,
      ai_right: result.totalScores.ai_right - roundStartScores.ai_right,
    },
  };
}

function updateHumanLiangDaoHint(player: Player): boolean {
  return player.hand.length % 3 === 2 && !player.isLiangDao && getTingDiscardOptions(player.hand, player.melds).length > 0;
}

/**
 * 补杠（自抓明杠）完成时结算杠分：普通明杠其余两家各赔 1 份，杠上明杠各赔 2 份。
 * 返回应用了杠分的玩家表与追加后的日志。
 */
function applyBuGangScore(
  players: Record<PlayerId, Player>,
  gangerId: PlayerId,
  isGangContext: boolean,
  baseScore: number,
  logs: string[],
  notes: Record<PlayerId, string[]>,
): { players: Record<PlayerId, Player>; logs: string[]; notes: Record<PlayerId, string[]> } {
  const gang = scoreGang({ players, gangType: "bu_gang", gangerId, isGangContext, baseScore });
  if (!gang) {
    return { players, logs: pushLog(logs, `${players[gangerId].name} 补杠成功，补摸一张`), notes };
  }
  return {
    players: applyGangScore(players, gang.scoreChanges),
    logs: pushLog(logs, `${players[gangerId].name} ${gang.label}，补摸一张`),
    notes: appendScoreNotes(notes, gang.scoreChanges, "杠", "被杠"),
  };
}

function forbiddenDiscardOwner(players: Record<PlayerId, Player>, selfId: PlayerId, kind: TileKind): Player | undefined {
  return Object.values(players).find(
    (player) => player.id !== selfId && player.isLiangDao && player.waitingKinds.includes(kind),
  );
}

function buyHorseValue(tile: TileInstance): number {
  return typeof tile.rank === "number" ? tile.rank : 10;
}

function shouldBuyOneGetOne(tile: TileInstance): boolean {
  return tile.rank === 1 && (tile.suit === "dot" || tile.suit === "bamboo");
}

const initialPlayers = createPlayers();
const DISCARD_TO_DRAW_DELAY_MS = 420;

/** 把名册（真人/AI、昵称）套用到玩家表，返回新表。 */
function applyRoster(
  players: Record<PlayerId, Player>,
  roster: Partial<Record<EngineSeatId, { name: string; isAi: boolean }>>,
): Record<PlayerId, Player> {
  const next = { ...players };
  for (const seat of Object.keys(roster) as EngineSeatId[]) {
    const entry = roster[seat];
    if (!entry) continue;
    next[seat] = { ...next[seat], type: entry.isAi ? "ai" : "human", name: entry.name };
  }
  return next;
}

/**
 * guest 客户端不跑引擎：把本地发起的动作转发给房主，返回 true 表示已转发、调用方应直接 return。
 * host/single 返回 false，照常执行引擎逻辑。
 */
let optimisticGuestActionDepth = 0;

function applyOptimisticGuestAction(action: () => void) {
  optimisticGuestActionDepth += 1;
  try {
    action();
  } finally {
    optimisticGuestActionDepth -= 1;
  }
}

function forwardIfGuest(
  state: { netRole: NetRole; netSeat: EngineSeatId; netForward?: (action: GuestActionInput) => void },
  action: Omit<GuestActionInput, "seat">,
): boolean {
  if (state.netRole !== "guest") return false;
  if (optimisticGuestActionDepth > 0) return false;
  state.netForward?.({ ...action, seat: state.netSeat });
  return true;
}

export const useGameStore = create<GameStore>((set, get) => ({
  wall: [],
  deadWall: [],
  players: initialPlayers,
  roundStartScores: playerScores(initialPlayers),
  roundScoreNotes: emptyRoundScoreNotes(),
  currentPlayerId: "human",
  dealerId: "human",
  phase: "ready",
  reactionPasses: [],
  logs: [],
  actionNonce: 0,
  canHumanLiangDao: false,
  gangCount: 0,
  baseScore: BASE_SCORE,
  nextBaseScore: BASE_SCORE,
  liangDaoZimoBuyHorseEnabled: false,
  nextLiangDaoZimoBuyHorseEnabled: false,
  netRole: "single",
  netSeat: "human",
  netForward: undefined,
  netRoster: undefined,
  netWinds: undefined,

  configureNet: ({ role, seat, forward }) => {
    // 切换联机角色时清掉上一局残留的对局状态，避免新房间继承旧分数/名册/结算窗口。
    set({
      netRole: role,
      netSeat: seat,
      netForward: forward,
      netRoster: undefined,
      netWinds: undefined,
      wall: [],
      deadWall: [],
      players: createPlayers(),
      roundStartScores: playerScores(createPlayers()),
      roundScoreNotes: emptyRoundScoreNotes(),
      currentPlayerId: "human",
      dealerId: "human",
      phase: "ready",
      roundResult: undefined,
      pendingReactions: undefined,
      pendingBuGang: undefined,
      reactionPasses: [],
      lastDiscard: undefined,
      selectedTileId: undefined,
      supplementContext: undefined,
      logs: [],
      canHumanLiangDao: false,
      gangCount: 0,
      baseScore: BASE_SCORE,
      liangDaoZimoBuyHorseEnabled: false,
    });
  },

  setNetSeat: (seat) => {
    set({ netSeat: seat });
  },

  setNetWinds: (winds) => {
    set({ netWinds: winds });
  },

  applyNetSnapshot: (snapshot) => {
    // guest 只渲染房主下发的视图，不跑引擎逻辑。
    // 注意：Firestore 开了 ignoreUndefinedProperties，写入时会剥掉值为 undefined 的字段，
    // 所以新一局的视图文档里可能根本没有 roundResult/lastDiscard 等键。这里必须显式列出这些
    // 可选字段（取不到即 undefined），强制覆盖掉上一局的残留值，否则进了新局会立刻又弹旧结算。
    set({
      ...snapshot,
      lastDiscard: snapshot.lastDiscard,
      pendingReactions: snapshot.pendingReactions,
      pendingBuGang: snapshot.pendingBuGang,
      roundResult: snapshot.roundResult,
      roundStartScores: snapshot.roundStartScores ?? playerScores(snapshot.players),
      roundScoreNotes: snapshot.roundScoreNotes ?? emptyRoundScoreNotes(),
      canHumanLiangDao: updateHumanLiangDaoHint(snapshot.players.human),
    });
  },

  applyNetRoster: (roster) => {
    const state = get();
    const players = applyRoster(state.players, roster);
    set({
      players,
      roundStartScores: state.phase === "ready" ? playerScores(players) : state.roundStartScores,
      roundScoreNotes: state.phase === "ready" ? emptyRoundScoreNotes() : state.roundScoreNotes,
      netRoster: roster,
    });
  },

  setNextLiangDaoZimoBuyHorseEnabled: (enabled) => {
    set({ nextLiangDaoZimoBuyHorseEnabled: enabled });
  },

  saveNextRoundSettings: ({ baseScore, liangDaoZimoBuyHorseEnabled }) => {
    const safeBaseScore = Math.max(1, Math.floor(baseScore));
    set({
      nextBaseScore: safeBaseScore,
      liangDaoZimoBuyHorseEnabled,
      nextLiangDaoZimoBuyHorseEnabled: liangDaoZimoBuyHorseEnabled,
    });
  },

  startNewRound: () => {
    const state = get();
    // guest 不跑引擎，发牌由房主权威进行并下发快照。
    if (state.netRole === "guest") return;
    const nextLiangDaoZimoBuyHorseEnabled = get().nextLiangDaoZimoBuyHorseEnabled;
    const nextBaseScore = get().nextBaseScore;
    const dealerId = state.roundResult?.winnerId ?? state.dealerId ?? "human";
    const previous = state.players;
    const players = createPlayers(previous, dealerId);
    const wall = shuffle(createTileSet());
    const dealt = { ...players };
    const nextWall = [...wall];

    for (const playerId of Object.keys(dealt) as PlayerId[]) {
      const handSize = playerId === dealerId ? 14 : 13;
      for (let index = 0; index < handSize; index += 1) dealt[playerId].hand.push(nextWall.shift()!);
    }

    dealt.human.hand = sortTiles(dealt.human.hand);
    dealt.ai_left.hand = sortTiles(dealt.ai_left.hand);
    dealt.ai_right.hand = sortTiles(dealt.ai_right.hand);

    // 联机房主：每局发牌后重新套用座位名册，避免真人座位被重置为 AI。
    const dealtWithRoster = state.netRoster ? applyRoster(dealt, state.netRoster) : dealt;
    const roundStartScores = playerScores(dealtWithRoster);

    set({
      wall: nextWall,
      deadWall: [],
      players: dealtWithRoster,
      roundStartScores,
      roundScoreNotes: emptyRoundScoreNotes(),
      currentPlayerId: dealerId,
      dealerId,
      phase: "playing",
      lastDiscard: undefined,
      pendingReactions: undefined,
      reactionPasses: [],
      pendingBuGang: undefined,
      selectedTileId: undefined,
      roundResult: undefined,
      supplementContext: undefined,
      canHumanLiangDao: updateHumanLiangDaoHint(dealt.human),
      gangCount: 0,
      baseScore: nextBaseScore,
      liangDaoZimoBuyHorseEnabled: nextLiangDaoZimoBuyHorseEnabled,
      logs: pushLog([], `新局开始，${dealtWithRoster[dealerId].name} 坐庄先出牌`),
      actionNonce: state.actionNonce + 1,
    });
  },

  shuffleWall: () => set({ wall: shuffle(createTileSet()) }),

  dealInitialHands: () => get().startNewRound(),

  drawTile: (playerId) => {
    const state = get();
    if (state.phase === "settled" || state.phase === "draw") return;
    const wall = [...state.wall];
    if (wall.length === 0) {
      const result = normalizeRoundResult(scoreDraw(state.players), state.roundStartScores);
      set({
        phase: "draw",
        roundResult: result,
        logs: pushLog(state.logs, "牌墙摸空，流局"),
      });
      return;
    }

    const tile = wall.shift()!;
    const players = { ...state.players };
    const player = players[playerId];
    players[playerId] = {
      ...player,
      hand: sortTiles([...player.hand, tile]),
      lastDrawnTileId: tile.id,
    };

    set({
      wall,
      players,
      currentPlayerId: playerId,
      phase: "playing",
      pendingReactions: undefined,
      reactionPasses: [],
      selectedTileId: undefined,
      supplementContext: undefined,
      canHumanLiangDao: playerId === "human" ? updateHumanLiangDaoHint(players.human) : state.canHumanLiangDao,
      logs: pushLog(state.logs, `${player.name} 摸牌`),
      actionNonce: state.actionNonce + 1,
    });
  },

  discardTile: (playerId, tileId) => {
    const state = get();
    if (state.phase !== "playing" || state.currentPlayerId !== playerId) return;
    const player = state.players[playerId];
    const tile = player.hand.find((item) => item.id === tileId);
    if (!tile) return;
    if (state.netRole === "guest" && optimisticGuestActionDepth === 0) {
      if (!state.netForward) return;
      state.netForward({ type: "discard", tileId, seat: state.netSeat });
      const players = { ...state.players };
      players[playerId] = {
        ...player,
        hand: sortTiles(player.hand.filter((item) => item.id !== tileId)),
        discards: [...player.discards, tile],
        lastDrawnTileId: undefined,
      };
      set({
        players,
        lastDiscard: { playerId, tile },
        pendingReactions: undefined,
        reactionPasses: [],
        pendingBuGang: undefined,
        phase: "dealing",
        selectedTileId: undefined,
        canHumanLiangDao: false,
        logs: pushLog(state.logs, `${player.name} 打出 ${TILE_KIND_LABEL[tile.kind]}`),
        actionNonce: state.actionNonce + 1,
      });
      return;
    }

    const forbiddenOwner = forbiddenDiscardOwner(state.players, playerId, tile.kind);
    const mustAvoidLiangDaoWaits = !player.isLiangDao && !player.autoPlay;
    if (forbiddenOwner && mustAvoidLiangDaoWaits) {
      const forbidden = getForbiddenDiscards(state.players, playerId);
      const hasLegalDiscard = player.hand.some((item) => !forbidden.has(item.kind));
      if (!hasLegalDiscard) {
        get().settleNoSafeDiscard(playerId);
        return;
      }
      set({
        logs: pushLog(state.logs, `${TILE_KIND_LABEL[tile.kind]} 是 ${forbiddenOwner.name} 的亮倒听牌，不能打出`),
        actionNonce: state.actionNonce + 1,
      });
      return;
    }

    const players = { ...state.players };
    const remaining = player.hand.filter((item) => item.id !== tileId);
    const waits = player.isLiangDao ? getWinningKinds(remaining, player.melds) : [];
    players[playerId] = {
      ...player,
      hand: sortTiles(remaining),
      discards: [...player.discards, tile],
      lastDrawnTileId: undefined,
      waitingKinds: waits,
    };

    const lastDiscard = { playerId, tile };
    const options = buildReactionOptions(players, lastDiscard);
    const hasOptions = options.length > 0;
    set({
      players,
      lastDiscard,
      pendingReactions: hasOptions ? { discard: lastDiscard, options } : undefined,
      phase: hasOptions ? "responding" : "dealing",
      reactionPasses: [],
      selectedTileId: undefined,
      canHumanLiangDao: false,
      supplementContext: state.supplementContext,
      logs: pushLog(state.logs, `${player.name} 打出 ${TILE_KIND_LABEL[tile.kind]}`),
      actionNonce: state.actionNonce + 1,
    });

    if (!hasOptions) get().nextTurn(DISCARD_TO_DRAW_DELAY_MS);
  },

  selectTile: (tileId) => set({ selectedTileId: tileId }),

  passReaction: (playerId) => {
    const state = get();
    if (forwardIfGuest(state, { type: "pass" })) {
      applyOptimisticGuestAction(() => get().passReaction(playerId));
      return;
    }
    if (!state.pendingReactions) return;
    set({
      reactionPasses: Array.from(new Set([...state.reactionPasses, playerId])),
      logs: pushLog(state.logs, `${state.players[playerId].name} 过`),
      actionNonce: state.actionNonce + 1,
    });
    get().resolveReactions();
  },

  claimPeng: (playerId) => {
    const state = get();
    if (forwardIfGuest(state, { type: "peng" })) {
      applyOptimisticGuestAction(() => get().claimPeng(playerId));
      return;
    }
    const pending = state.pendingReactions;
    if (!pending) return;
    const top = topPriorityReaction(pending, state.reactionPasses);
    if (top?.playerId !== playerId || !top.canPeng) return;
    const option = pending.options.find((item) => item.playerId === playerId);
    if (!option?.canPeng) return;
    const kind = pending.discard.tile.kind;
    const player = state.players[playerId];
    const claimed = takeTilesByKind(player.hand, kind, 2);
    if (claimed.length < 2) return;

    const players = { ...state.players };
    players[pending.discard.playerId] = {
      ...players[pending.discard.playerId],
      discards: players[pending.discard.playerId].discards.filter((tile) => tile.id !== pending.discard.tile.id),
    };
    players[playerId] = {
      ...player,
      hand: sortTiles(removeTilesByKind(player.hand, kind, 2)),
      melds: [
        ...player.melds,
        {
          id: `peng-${kind}-${Date.now()}`,
          type: "peng",
          tiles: [...claimed, pending.discard.tile],
          fromPlayerId: pending.discard.playerId,
        },
      ],
      lastDrawnTileId: undefined,
    };

    set({
      players,
      currentPlayerId: playerId,
      phase: "playing",
      pendingReactions: undefined,
      reactionPasses: [],
      lastDiscard: undefined,
      logs: pushLog(state.logs, `${player.name} 碰 ${TILE_KIND_LABEL[kind]}`),
      actionNonce: state.actionNonce + 1,
    });
  },

  claimMingGang: (playerId) => {
    const state = get();
    if (forwardIfGuest(state, { type: "ming_gang" })) {
      applyOptimisticGuestAction(() => get().claimMingGang(playerId));
      return;
    }
    const pending = state.pendingReactions;
    if (!pending) return;
    const top = topPriorityReaction(pending, state.reactionPasses);
    if (top?.playerId !== playerId || !top.canGang) return;
    const option = pending.options.find((item) => item.playerId === playerId);
    if (!option?.canGang) return;
    const kind = pending.discard.tile.kind;
    const player = state.players[playerId];
    const claimed = takeTilesByKind(player.hand, kind, 3);
    if (claimed.length < 3) return;

    const wall = [...state.wall];
    const supplement = wall.pop();
    const players = { ...state.players };
    players[pending.discard.playerId] = {
      ...players[pending.discard.playerId],
      discards: players[pending.discard.playerId].discards.filter((tile) => tile.id !== pending.discard.tile.id),
    };
    players[playerId] = {
      ...player,
      hand: sortTiles([
        ...removeTilesByKind(player.hand, kind, 3),
        ...(supplement ? [supplement] : []),
      ]),
      melds: [
        ...player.melds,
        {
          id: `ming-gang-${kind}-${Date.now()}`,
          type: "ming_gang",
          tiles: [...claimed, pending.discard.tile],
          fromPlayerId: pending.discard.playerId,
        },
      ],
      lastDrawnTileId: supplement?.id,
    };

    if (!supplement) {
      const result = normalizeRoundResult(scoreDraw(players), state.roundStartScores);
      set({ players: applyRoundResult(players, result), wall, phase: "draw", roundResult: result, logs: pushLog(state.logs, "杠后无牌，流局") });
      return;
    }

    const isGangContext = state.supplementContext === "gangshang";
    const gang = scoreGang({
      players,
      gangType: "ming_gang",
      gangerId: playerId,
      dianGangPlayerId: pending.discard.playerId,
      isGangContext,
      baseScore: state.baseScore,
    });
    const scoredPlayers = gang ? applyGangScore(players, gang.scoreChanges) : players;
    const roundScoreNotes = gang
      ? appendScoreNotes(state.roundScoreNotes, gang.scoreChanges, "杠", "被杠")
      : state.roundScoreNotes;

    set({
      wall,
      players: scoredPlayers,
      roundScoreNotes,
      currentPlayerId: playerId,
      phase: "playing",
      pendingReactions: undefined,
      reactionPasses: [],
      lastDiscard: undefined,
      supplementContext: "gangshang",
      logs: pushLog(
        state.logs,
        gang
          ? `${player.name} 杠 ${TILE_KIND_LABEL[kind]}（${gang.label}），补摸一张`
          : `${player.name} 杠 ${TILE_KIND_LABEL[kind]}，补摸一张`,
      ),
      actionNonce: state.actionNonce + 1,
    });
  },

  claimAnGang: (playerId, tileType) => {
    const state = get();
    if (forwardIfGuest(state, { type: "an_gang", tileKind: tileType })) {
      applyOptimisticGuestAction(() => get().claimAnGang(playerId, tileType));
      return;
    }
    const player = state.players[playerId];
    if (state.phase !== "playing" || state.currentPlayerId !== playerId) return;
    if (!getAnGangKinds(player.hand).includes(tileType)) return;
    const wall = [...state.wall];
    const supplement = wall.pop();
    const gangTiles = takeTilesByKind(player.hand, tileType, 4);
    const players = { ...state.players };
    players[playerId] = {
      ...player,
      hand: sortTiles([
        ...removeTilesByKind(player.hand, tileType, 4),
        ...(supplement ? [supplement] : []),
      ]),
      melds: [
        ...player.melds,
        {
          id: `an-gang-${tileType}-${Date.now()}`,
          type: "an_gang",
          tiles: gangTiles,
          concealed: true,
        },
      ],
      lastDrawnTileId: supplement?.id,
    };
    if (!supplement) {
      const result = normalizeRoundResult(scoreDraw(players), state.roundStartScores);
      set({
        wall,
        players: applyRoundResult(players, result),
        phase: "draw",
        roundResult: result,
        logs: pushLog(state.logs, "暗杠后无牌，流局"),
        actionNonce: state.actionNonce + 1,
      });
      return;
    }
    const isGangContext = state.supplementContext === "gangshang";
    const gang = scoreGang({
      players,
      gangType: "an_gang",
      gangerId: playerId,
      isGangContext,
      baseScore: state.baseScore,
    });
    const scoredPlayers = gang ? applyGangScore(players, gang.scoreChanges) : players;
    const roundScoreNotes = gang
      ? appendScoreNotes(state.roundScoreNotes, gang.scoreChanges, "杠", "被杠")
      : state.roundScoreNotes;
    set({
      wall,
      players: scoredPlayers,
      roundScoreNotes,
      supplementContext: "gangshang",
      logs: pushLog(
        state.logs,
        gang
          ? `${player.name} 暗杠 ${TILE_KIND_LABEL[tileType]}（${gang.label}），补摸一张`
          : `${player.name} 暗杠 ${TILE_KIND_LABEL[tileType]}，补摸一张`,
      ),
      actionNonce: state.actionNonce + 1,
    });
  },

  claimBuGang: (playerId, meldId) => {
    const state = get();
    if (forwardIfGuest(state, { type: "bu_gang", meldId })) {
      applyOptimisticGuestAction(() => get().claimBuGang(playerId, meldId));
      return;
    }
    const player = state.players[playerId];
    if (state.phase !== "playing" || state.currentPlayerId !== playerId) return;
    const meld = player.melds.find((item) => item.id === meldId && item.type === "peng");
    if (!meld) return;
    const kind = meld.tiles[0].kind;
    const tile = player.hand.find((item) => item.kind === kind);
    if (!tile) return;

    const otherOptions = getPlayersAfter(playerId)
      .map((otherId) => {
        const other = state.players[otherId];
        return {
          playerId: otherId,
          canHu: analyzeWin([...other.hand, tile], tile.kind, other.melds).isWin,
          canPeng: false,
          canGang: false,
        };
      })
      .filter((option) => option.canHu);

    if (otherOptions.length > 0) {
      set({
        pendingBuGang: { playerId, meldId, tile },
        pendingReactions: {
          discard: { playerId, tile },
          options: otherOptions,
        },
        phase: "responding",
        reactionPasses: [],
        logs: pushLog(state.logs, `${player.name} 补杠 ${TILE_KIND_LABEL[kind]}，等待抢杠胡`),
        actionNonce: state.actionNonce + 1,
      });
      return;
    }

    const wall = [...state.wall];
    const supplement = wall.pop();
    const players = { ...state.players };
    players[playerId] = {
      ...player,
      hand: sortTiles(player.hand.filter((item) => item.id !== tile.id).concat(supplement ? [supplement] : [])),
      melds: player.melds.map((item) =>
        item.id === meldId ? { ...item, type: "bu_gang", tiles: [...item.tiles, tile] } : item,
      ),
      lastDrawnTileId: supplement?.id,
    };
    if (!supplement) {
      const result = normalizeRoundResult(scoreDraw(players), state.roundStartScores);
      set({
        wall,
        players: applyRoundResult(players, result),
        phase: "draw",
        roundResult: result,
        pendingBuGang: undefined,
        pendingReactions: undefined,
        reactionPasses: [],
        logs: pushLog(state.logs, "补杠后无牌，流局"),
        actionNonce: state.actionNonce + 1,
      });
      return;
    }
    const scored = applyBuGangScore(
      players,
      playerId,
      state.supplementContext === "gangshang",
      state.baseScore,
      state.logs,
      state.roundScoreNotes,
    );
    set({
      wall,
      players: scored.players,
      roundScoreNotes: scored.notes,
      supplementContext: "gangshang",
      logs: scored.logs,
      actionNonce: state.actionNonce + 1,
    });
  },

  declareLiangDao: (playerId, discardTileId) => {
    const state = get();
    if (forwardIfGuest(state, { type: "liang_dao", tileId: discardTileId })) {
      applyOptimisticGuestAction(() => get().declareLiangDao(playerId, discardTileId));
      return;
    }
    const player = state.players[playerId];
    if (player.isLiangDao || state.currentPlayerId !== playerId || state.phase !== "playing") return;
    const tile = player.hand.find((item) => item.id === discardTileId);
    if (!tile) return;
    const forbiddenOwner = forbiddenDiscardOwner(state.players, playerId, tile.kind);
    if (forbiddenOwner) {
      set({
        logs: pushLog(state.logs, `${TILE_KIND_LABEL[tile.kind]} 是 ${forbiddenOwner.name} 的亮倒听牌，不能亮倒打出`),
        actionNonce: state.actionNonce + 1,
      });
      return;
    }
    const remaining = player.hand.filter((item) => item.id !== discardTileId);
    const waits = getWinningKinds(remaining, player.melds);
    if (waits.length === 0) return;

    const players = { ...state.players };
    players[playerId] = {
      ...player,
      isLiangDao: true,
      autoPlay: true,
      waitingKinds: waits,
    };
    set({
      players,
      logs: pushLog(state.logs, `${player.name} 亮倒，听 ${waits.map((kind) => TILE_KIND_LABEL[kind]).join("、")}`),
      actionNonce: state.actionNonce + 1,
    });
    get().discardTile(playerId, discardTileId);
  },

  claimHu: (playerId) => {
    const state = get();
    if (state.phase !== "playing" && state.phase !== "responding") return;
    if (forwardIfGuest(state, { type: "hu" })) {
      applyOptimisticGuestAction(() => get().claimHu(playerId));
      return;
    }
    if (state.pendingBuGang) {
      if (state.pendingReactions) {
        const top = topPriorityReaction(state.pendingReactions, state.reactionPasses);
        const huPlayerIds = pendingHuPlayerIds(state.pendingReactions, state.reactionPasses);
        if (!top?.canHu || !huPlayerIds.includes(playerId)) return;
        get().settleWins(huPlayerIds, "qianggang", state.pendingBuGang.playerId, state.pendingBuGang.tile);
        return;
      }
      get().settleWin(playerId, "qianggang", state.pendingBuGang.playerId, state.pendingBuGang.tile);
      return;
    }
    if (state.pendingReactions) {
      const top = topPriorityReaction(state.pendingReactions, state.reactionPasses);
      const huPlayerIds = pendingHuPlayerIds(state.pendingReactions, state.reactionPasses);
      if (!top?.canHu || !huPlayerIds.includes(playerId)) return;
      const discard = state.pendingReactions.discard;
      get().settleWins(huPlayerIds, "discard", discard.playerId, discard.tile);
      return;
    }
    if (state.phase !== "playing" || state.currentPlayerId !== playerId) return;
    const player = state.players[playerId];
    const winningTile = player.hand.find((tile) => tile.id === player.lastDrawnTileId) ?? player.hand[player.hand.length - 1];
    const method = state.supplementContext === "gangshang" ? "gangshang" : "zimo";
    get().settleWin(playerId, method, undefined, winningTile);
  },

  resolveReactions: () => {
    const state = get();
    const pending = state.pendingReactions;
    if (!pending) return;
    const remaining = pending.options.filter((option) => !state.reactionPasses.includes(option.playerId));
    if (remaining.length > 0) return;

    if (state.pendingBuGang) {
      const { playerId, meldId, tile } = state.pendingBuGang;
      const player = state.players[playerId];
      const wall = [...state.wall];
      const supplement = wall.pop();
      const players = { ...state.players };
      players[playerId] = {
        ...player,
        hand: sortTiles(player.hand.filter((item) => item.id !== tile.id).concat(supplement ? [supplement] : [])),
        melds: player.melds.map((item) =>
          item.id === meldId ? { ...item, type: "bu_gang", tiles: [...item.tiles, tile] } : item,
        ),
        lastDrawnTileId: supplement?.id,
      };
      if (!supplement) {
        const result = normalizeRoundResult(scoreDraw(players), state.roundStartScores);
        set({
          wall,
          players: applyRoundResult(players, result),
          pendingReactions: undefined,
          pendingBuGang: undefined,
          reactionPasses: [],
          phase: "draw",
          roundResult: result,
          logs: pushLog(state.logs, "无人抢杠胡，补杠后无牌，流局"),
          actionNonce: state.actionNonce + 1,
        });
        return;
      }
      const scored = applyBuGangScore(
        players,
        playerId,
        state.supplementContext === "gangshang",
        state.baseScore,
        state.logs,
        state.roundScoreNotes,
      );
      set({
        wall,
        players: scored.players,
        roundScoreNotes: scored.notes,
        currentPlayerId: playerId,
        pendingReactions: undefined,
        pendingBuGang: undefined,
        reactionPasses: [],
        phase: "playing",
        supplementContext: "gangshang",
        logs: scored.logs,
        actionNonce: state.actionNonce + 1,
      });
      return;
    }

    set({
      pendingReactions: undefined,
      pendingBuGang: undefined,
      reactionPasses: [],
      phase: "dealing",
      supplementContext: undefined,
      actionNonce: state.actionNonce + 1,
    });
    get().nextTurn(DISCARD_TO_DRAW_DELAY_MS);
  },

  nextTurn: (delayMs = 0) => {
    if (optimisticGuestActionDepth > 0) return;
    const expectedActionNonce = get().actionNonce;
    const advance = () => {
      const state = get();
      if (state.actionNonce !== expectedActionNonce) return;
      if (state.phase === "settled" || state.phase === "draw" || state.phase === "responding") return;
      const next = getNextPlayerId(state.lastDiscard?.playerId ?? state.currentPlayerId);
      get().drawTile(next);
    };

    if (delayMs > 0) {
      window.setTimeout(advance, delayMs);
      return;
    }

    advance();
  },

  settleWin: (winnerId, method, loserId, winningTile) => {
    const state = get();
    if (state.phase !== "playing" && state.phase !== "responding") return;
    const wall = [...state.wall];
    const player = state.players[winnerId];
    const tile = winningTile ?? player.hand.find((item) => item.id === player.lastDrawnTileId);
    const tilesForWin =
      method === "discard" || method === "qianggang"
        ? [...player.hand, ...(tile ? [tile] : [])]
        : player.hand;
    const win = analyzeWin(tilesForWin, tile?.kind, player.melds);
    if (!win.isWin) return;
    const isGangShangPao = method === "discard" && state.supplementContext === "gangshang";
    const isHaiDiLao = method === "zimo" && state.wall.length === 0;
    let result = scoreWin({
      players: state.players,
      winnerId,
      loserId,
      method,
      win,
      baseScore: state.baseScore,
      isGangShangPao,
      isHaiDiLao,
    });
    let roundScoreNotes = appendWinScoreNotes(state.roundScoreNotes, result);
    const shouldBuyHorse =
      state.liangDaoZimoBuyHorseEnabled &&
      player.isLiangDao &&
      (method === "zimo" || method === "gangshang") &&
      wall.length > 0;
    const buyHorseTile = shouldBuyHorse ? wall.shift() : undefined;
    const buyHorseTiles: TileInstance[] = [];
    if (buyHorseTile) {
      buyHorseTiles.push(buyHorseTile);
      if (shouldBuyOneGetOne(buyHorseTile) && wall.length > 0) {
        const extraBuyHorseTile = wall.shift();
        if (extraBuyHorseTile) buyHorseTiles.push(extraBuyHorseTile);
      }
    }

    if (buyHorseTiles.length > 0) {
      const buyHorseItems = buyHorseTiles.map((tile) => {
        const value = buyHorseValue(tile);
        return { tile, value, bonus: value * state.baseScore };
      });
      const value = buyHorseItems.reduce((sum, item) => sum + item.value, 0);
      const bonus = buyHorseItems.reduce((sum, item) => sum + item.bonus, 0);
      const scoreChanges = { ...result.scoreChanges };
      const ids = Object.keys(state.players) as PlayerId[];
      for (const id of ids) {
        if (id === winnerId) continue;
        scoreChanges[id] -= bonus;
        scoreChanges[winnerId] += bonus;
      }
      result = {
        ...result,
        scoreChanges,
        totalScores: Object.fromEntries(
          ids.map((id) => [id, state.players[id].score + scoreChanges[id]]),
        ) as Record<PlayerId, number>,
        buyHorse: {
          tile: buyHorseItems[0]!.tile,
          value,
          bonus,
          items: buyHorseItems,
          totalValue: value,
          isBuyOneGetOne: buyHorseItems.length > 1,
        },
      };
      roundScoreNotes = appendBuyHorseScoreNotes(roundScoreNotes, winnerId, ids, bonus);
    }
    result = normalizeRoundResult(result, state.roundStartScores);
    set({
      wall,
      players: applyRoundResult(state.players, result),
      roundScoreNotes,
      phase: "settled",
      roundResult: result,
      pendingReactions: undefined,
      pendingBuGang: undefined,
      reactionPasses: [],
      logs: pushLog(
        state.logs,
        buyHorseTile
          ? `${result.title}，买马 ${buyHorseTiles.map((tile) => TILE_KIND_LABEL[tile.kind]).join("、")} +${result.buyHorse?.bonus ?? 0}`
          : result.title,
      ),
      actionNonce: state.actionNonce + 1,
    });
  },

  settleWins: (winnerIds, method, loserId, winningTile) => {
    const state = get();
    if (state.phase !== "responding") return;
    const ids = Object.keys(state.players) as PlayerId[];
    const uniqueWinnerIds = Array.from(new Set(winnerIds)).filter((id) => id !== loserId);
    const isGangShangPao = method === "discard" && state.supplementContext === "gangshang";
    const scoreResults: ScoreResult[] = [];

    for (const winnerId of uniqueWinnerIds) {
      const player = state.players[winnerId];
      const win = analyzeWin([...player.hand, winningTile], winningTile.kind, player.melds);
      if (!win.isWin) continue;
      scoreResults.push(
        scoreWin({
          players: state.players,
          winnerId,
          loserId,
          method,
          win,
          baseScore: state.baseScore,
          isGangShangPao,
        }),
      );
    }

    if (scoreResults.length === 0) return;
    if (scoreResults.length === 1) {
      const roundScoreNotes = appendWinScoreNotes(state.roundScoreNotes, scoreResults[0]);
      const result = normalizeRoundResult(scoreResults[0], state.roundStartScores);
      set({
        players: applyRoundResult(state.players, result),
        roundScoreNotes,
        phase: "settled",
        roundResult: result,
        pendingReactions: undefined,
        pendingBuGang: undefined,
        reactionPasses: [],
        logs: pushLog(state.logs, result.title),
        actionNonce: state.actionNonce + 1,
      });
      return;
    }

    const scoreChanges = Object.fromEntries(ids.map((id) => [id, 0])) as Record<PlayerId, number>;
    let roundScoreNotes = state.roundScoreNotes;
    for (const scoreResult of scoreResults) {
      roundScoreNotes = appendWinScoreNotes(roundScoreNotes, scoreResult);
      for (const id of ids) {
        scoreChanges[id] += scoreResult.scoreChanges[id];
      }
    }

    const first = scoreResults[0]!;
    const totalScores = Object.fromEntries(
      ids.map((id) => [id, state.players[id].score + scoreChanges[id]]),
    ) as Record<PlayerId, number>;
    const winnerNames = scoreResults
      .map((scoreResult) => state.players[scoreResult.winnerId!].name)
      .join("、");
    const titlePrefix = method === "qianggang" ? "多人抢杠胡" : "一炮双响";
    const result: ScoreResult = normalizeRoundResult({
      ...first,
      scoreChanges,
      totalScores,
      title: `${titlePrefix}：${winnerNames}`,
      winDetails: scoreResults.map((scoreResult) => ({
        winnerId: scoreResult.winnerId!,
        loserId: scoreResult.loserId,
        method: scoreResult.method!,
        fans: scoreResult.fans,
        totalFan: scoreResult.totalFan,
        baseScore: scoreResult.baseScore,
        multiplier: scoreResult.multiplier,
        title: scoreResult.title,
      })),
    }, state.roundStartScores);

    set({
      players: applyRoundResult(state.players, result),
      roundScoreNotes,
      phase: "settled",
      roundResult: result,
      pendingReactions: undefined,
      pendingBuGang: undefined,
      reactionPasses: [],
      logs: pushLog(state.logs, result.title),
      actionNonce: state.actionNonce + 1,
    });
  },

  settleNoSafeDiscard: (playerId) => {
    const state = get();
    const result = normalizeRoundResult(scoreDraw(state.players), state.roundStartScores);
    set({
      phase: "draw",
      roundResult: result,
      pendingReactions: undefined,
      pendingBuGang: undefined,
      reactionPasses: [],
      logs: pushLog(state.logs, `${state.players[playerId].name} 无可安全出牌，流局`),
      actionNonce: state.actionNonce + 1,
    });
  },

  resetRound: () => get().startNewRound(),
}));
