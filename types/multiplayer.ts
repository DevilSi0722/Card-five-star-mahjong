import type { GameState, TileKind } from "./mahjong";

/** 游戏模式：单机 vs 联机。 */
export type GameMode = "single" | "multiplayer";

/**
 * 引擎固定的三个座位 id（同时也是 PlayerId）。
 * 约定：房主始终占用 "human" 座位，这样房主本地引擎无需旋转即可正确渲染。
 * 其余真人/AI 占用 "ai_right"、"ai_left"。
 */
export type EngineSeatId = "human" | "ai_right" | "ai_left";

/** 出牌顺序：human → ai_right → ai_left，与引擎 PLAYER_ORDER 保持一致。 */
export const SEAT_TURN_ORDER: EngineSeatId[] = ["human", "ai_right", "ai_left"];

/** 房间设置（房主可配置）。 */
export interface RoomSettings {
  /** 总局数。 */
  rounds: number;
  /** 底分。 */
  baseScore: number;
  /** 是否开启「亮倒自摸买马」。 */
  liangDaoZimoBuyHorse: boolean;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  rounds: 4,
  baseScore: 1,
  liangDaoZimoBuyHorse: false,
};

/** 房间生命周期状态。 */
export type RoomStatus = "waiting" | "playing" | "finished";

/** 房间内一个就座成员（真人或 AI 补位）。 */
export interface RoomPlayer {
  /** 客户端生成的唯一标识；AI 补位用 "ai:" 前缀。 */
  clientId: string;
  /** 昵称。 */
  name: string;
  /** 分配到的引擎座位。 */
  seat: EngineSeatId;
  /** 是否房主。 */
  isHost: boolean;
  /** 是否为电脑补位。 */
  isAi: boolean;
  /** 加入时间戳（毫秒）。 */
  joinedAt: number;
  /** 心跳时间戳（毫秒），用于检测掉线。 */
  lastSeen: number;
}

/** 房间文档（Firestore：rooms/{code}）。 */
export interface Room {
  /** 4 位房间号，同时是文档 id。 */
  code: string;
  /** 房主 clientId。 */
  hostClientId: string;
  status: RoomStatus;
  settings: RoomSettings;
  /** 已就座成员（含 AI 补位）。 */
  players: RoomPlayer[];
  /** 当前第几局，从 1 开始；waiting 时为 0。 */
  currentRound: number;
  createdAt: number;
  updatedAt: number;
}

/** 联机动作类型（来自 guest，发回房主套用到引擎）。 */
export type NetActionType =
  | "discard"
  | "peng"
  | "ming_gang"
  | "an_gang"
  | "bu_gang"
  | "liang_dao"
  | "hu"
  | "pass";

/** 客户端身份：单机 / 房主（跑引擎）/ 访客（只渲染收到的视图）。 */
export type NetRole = "single" | "host" | "guest";

/** guest 在本地发起、转发给房主的动作载荷（不含 id/时间戳）。 */
export interface GuestActionInput {
  type: NetActionType;
  /** 发起者的真实引擎座位。 */
  seat: EngineSeatId;
  tileId?: string;
  tileKind?: TileKind;
  meldId?: string;
}

/** 一条联机动作（Firestore：rooms/{code}/actions/{id}）。 */
export interface NetAction {
  id: string;
  /** 发起者的真实引擎座位。 */
  seat: EngineSeatId;
  type: NetActionType;
  tileId?: string;
  tileKind?: TileKind;
  meldId?: string;
  createdAt: number;
}

/**
 * 房主发布给某个座位的牌局视图（Firestore：rooms/{code}/views/{seat}）。
 * 已按该座位旋转（自己 = human/bottom）并裁剪（隐藏他人手牌）。
 * 直接是一份可被 gameStore 吸收的引擎 GameState 切片。
 */
export interface NetGameView {
  /** 视图所属的真实座位（裁剪/旋转前的座位）。 */
  forSeat: EngineSeatId;
  /** 房主发布时的序号，guest 用于丢弃过期视图。 */
  rev: number;
  /** 旋转 + 裁剪后的引擎状态。 */
  state: NetGameSnapshot;
}

/** 发布到网络的引擎状态快照（GameState 的可序列化子集）。 */
export type NetGameSnapshot = Pick<
  GameState,
  | "players"
  | "currentPlayerId"
  | "dealerId"
  | "phase"
  | "lastDiscard"
  | "pendingReactions"
  | "reactionPasses"
  | "pendingBuGang"
  | "roundResult"
  | "logs"
  | "actionNonce"
  | "baseScore"
  | "wall"
>;
