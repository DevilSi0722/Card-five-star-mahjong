import type { Meld, Player, PlayerId, TileInstance } from "@/types/mahjong";
import type { EngineSeatId, NetGameSnapshot, Wind } from "@/types/multiplayer";
import { SEAT_TURN_ORDER } from "@/types/multiplayer";

const SEAT_BY_DISPLAY: Record<EngineSeatId, Player["seat"]> = {
  human: "bottom",
  ai_right: "right",
  ai_left: "left",
};

function seatIndex(seat: EngineSeatId): number {
  return SEAT_TURN_ORDER.indexOf(seat);
}

/**
 * 把「真实座位」映射为「某观察者视角下的显示座位」，并保持出牌顺序不变。
 * 观察者自己永远映射为 human（底部）。
 */
export function realToDisplaySeat(realSeat: EngineSeatId, viewerSeat: EngineSeatId): EngineSeatId {
  const di = (seatIndex(realSeat) - seatIndex(viewerSeat) + SEAT_TURN_ORDER.length) % SEAT_TURN_ORDER.length;
  return SEAT_TURN_ORDER[di];
}

/** 显示座位 → 真实座位（观察者发起动作时把 "human" 还原成自己的真实座位）。 */
export function displayToRealSeat(displaySeat: EngineSeatId, viewerSeat: EngineSeatId): EngineSeatId {
  const ri = (seatIndex(displaySeat) + seatIndex(viewerSeat)) % SEAT_TURN_ORDER.length;
  return SEAT_TURN_ORDER[ri];
}

/**
 * 把「真实座位→风位」映射旋转为「某观察者视角下的显示座位→风位」。
 * 观察者自己的风位落在 human（底部），其余按显示座位归位。
 */
export function rotateWindsForSeat(
  realWinds: Record<EngineSeatId, Wind>,
  viewerSeat: EngineSeatId,
): Record<EngineSeatId, Wind> {
  const result = {} as Record<EngineSeatId, Wind>;
  for (const realSeat of SEAT_TURN_ORDER) {
    result[realToDisplaySeat(realSeat, viewerSeat)] = realWinds[realSeat];
  }
  return result;
}

let hiddenCounter = 0;
/** 生成一张匿名占位牌（用于隐藏他人暗手牌与牌墙，避免泄露牌面）。 */
function hiddenTile(): TileInstance {
  hiddenCounter += 1;
  return { id: `hidden:${hiddenCounter}`, suit: "dot", rank: 1, kind: "dot-1", copy: 0 };
}

function mapMeld(meld: Meld, viewerSeat: EngineSeatId): Meld {
  return {
    ...meld,
    fromPlayerId: meld.fromPlayerId ? realToDisplaySeat(meld.fromPlayerId, viewerSeat) : undefined,
  };
}

/**
 * 裁剪并旋转单个玩家：
 * - 自己（displaySeat === human）：完整保留手牌与摸牌。
 * - 已亮倒玩家：手牌公开（游戏规则使然），保留真实牌面。
 * - 其余玩家：手牌替换为等量匿名占位牌，隐藏摸牌 id。
 */
function rotatePlayer(player: Player, viewerSeat: EngineSeatId): Player {
  const displaySeat = realToDisplaySeat(player.id, viewerSeat);
  const isSelf = displaySeat === "human";
  const reveal = isSelf || player.isLiangDao;
  return {
    ...player,
    id: displaySeat,
    seat: SEAT_BY_DISPLAY[displaySeat],
    hand: reveal ? player.hand : player.hand.map(() => hiddenTile()),
    melds: player.melds.map((meld) => mapMeld(meld, viewerSeat)),
    lastDrawnTileId: isSelf ? player.lastDrawnTileId : undefined,
  };
}

function mapPlayerId(id: PlayerId | undefined, viewerSeat: EngineSeatId): PlayerId | undefined {
  return id ? realToDisplaySeat(id, viewerSeat) : undefined;
}

function rotateActionAnnouncement(
  announcement: NetGameSnapshot["actionAnnouncement"],
  viewerSeat: EngineSeatId,
): NetGameSnapshot["actionAnnouncement"] {
  return announcement
    ? {
        ...announcement,
        badges: announcement.badges.map((badge) => ({
          ...badge,
          playerId: realToDisplaySeat(badge.playerId, viewerSeat),
        })),
      }
    : undefined;
}

/**
 * 把房主权威引擎状态裁剪 + 旋转成「某观察者视角」的可发布快照。
 * 观察者永远坐在底部（human），看不到他人暗手牌与牌墙具体牌面。
 */
export function cropSnapshotForSeat(
  state: NetGameSnapshot,
  viewerSeat: EngineSeatId,
): NetGameSnapshot {
  const players = {} as NetGameSnapshot["players"];
  for (const player of Object.values(state.players)) {
    const rotated = rotatePlayer(player, viewerSeat);
    players[rotated.id] = rotated;
  }

  const lastDiscard = state.lastDiscard
    ? { ...state.lastDiscard, playerId: realToDisplaySeat(state.lastDiscard.playerId, viewerSeat) }
    : undefined;

  const pendingReactions = state.pendingReactions
    ? {
        discard: {
          ...state.pendingReactions.discard,
          playerId: realToDisplaySeat(state.pendingReactions.discard.playerId, viewerSeat),
        },
        options: state.pendingReactions.options.map((option) => ({
          ...option,
          playerId: realToDisplaySeat(option.playerId, viewerSeat),
        })),
      }
    : undefined;

  const pendingBuGang = state.pendingBuGang
    ? { ...state.pendingBuGang, playerId: realToDisplaySeat(state.pendingBuGang.playerId, viewerSeat) }
    : undefined;

  const roundResult = state.roundResult
    ? rotateRoundResult(state.roundResult, viewerSeat)
    : undefined;
  const roundStartScores = remapScoreRecord(state.roundStartScores, viewerSeat);
  const roundScoreNotes = remapNotesRecord(state.roundScoreNotes, viewerSeat);

  return {
    players,
    deadWall: state.deadWall.map(() => hiddenTile()),
    currentPlayerId: realToDisplaySeat(state.currentPlayerId, viewerSeat),
    dealerId: realToDisplaySeat(state.dealerId, viewerSeat),
    phase: state.phase,
    lastDiscard,
    pendingReactions,
    reactionPasses: state.reactionPasses.map((id) => realToDisplaySeat(id, viewerSeat)),
    pendingBuGang,
    roundResult,
    roundStartScores,
    roundScoreNotes,
    actionAnnouncement: rotateActionAnnouncement(state.actionAnnouncement, viewerSeat),
    logs: state.logs,
    actionNonce: state.actionNonce,
    supplementContext: state.supplementContext,
    gangCount: state.gangCount,
    baseScore: state.baseScore,
    liangDaoZimoBuyHorseEnabled: state.liangDaoZimoBuyHorseEnabled,
    // 隐藏牌墙具体牌面，仅保留数量（牌墙剩余张数用于 UI）。
    wall: state.wall.map(() => hiddenTile()),
  };
}

function remapScoreRecord(record: Record<PlayerId, number>, viewerSeat: EngineSeatId): Record<PlayerId, number> {
  const next = {} as Record<PlayerId, number>;
  for (const [id, value] of Object.entries(record) as [PlayerId, number][]) {
    next[realToDisplaySeat(id, viewerSeat)] = value;
  }
  return next;
}

function remapNotesRecord(record: Record<PlayerId, string[]>, viewerSeat: EngineSeatId): Record<PlayerId, string[]> {
  const next = {} as Record<PlayerId, string[]>;
  for (const [id, value] of Object.entries(record) as [PlayerId, string[]][]) {
    next[realToDisplaySeat(id, viewerSeat)] = value;
  }
  return next;
}

/** 旋转结算结果里的所有 PlayerId 键值，使每位观察者都从自身视角阅读比分。 */
function rotateRoundResult(
  result: NonNullable<NetGameSnapshot["roundResult"]>,
  viewerSeat: EngineSeatId,
): NonNullable<NetGameSnapshot["roundResult"]> {
  return {
    ...result,
    winnerId: mapPlayerId(result.winnerId, viewerSeat),
    loserId: mapPlayerId(result.loserId, viewerSeat),
    scoreChanges: remapScoreRecord(result.scoreChanges, viewerSeat),
    totalScores: remapScoreRecord(result.totalScores, viewerSeat),
    winDetails: result.winDetails?.map((detail) => ({
      ...detail,
      winnerId: realToDisplaySeat(detail.winnerId, viewerSeat),
      loserId: mapPlayerId(detail.loserId, viewerSeat),
    })),
  };
}
