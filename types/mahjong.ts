export type TileSuit = "dot" | "bamboo" | "dragon";
export type DragonRank = "red" | "green" | "white";
export type TileRank = number | DragonRank;
export type TileKind = `${TileSuit}-${TileRank}`;

export interface TileInstance {
  id: string;
  suit: TileSuit;
  rank: TileRank;
  kind: TileKind;
  copy: number;
}

export type PlayerId = "human" | "ai_left" | "ai_right";
export type PlayerType = "human" | "ai";

export type MeldType = "peng" | "ming_gang" | "an_gang" | "bu_gang";

export interface Meld {
  id: string;
  type: MeldType;
  tiles: TileInstance[];
  fromPlayerId?: PlayerId;
  concealed?: boolean;
}

export interface Player {
  id: PlayerId;
  type: PlayerType;
  name: string;
  seat: "bottom" | "left" | "right";
  hand: TileInstance[];
  discards: TileInstance[];
  melds: Meld[];
  score: number;
  isDealer: boolean;
  isLiangDao: boolean;
  autoPlay: boolean;
  waitingKinds: TileKind[];
  lastDrawnTileId?: string;
}

export type GamePhase =
  | "ready"
  | "dealing"
  | "playing"
  | "responding"
  | "settled"
  | "draw";

export type PlayerAction =
  | "discard"
  | "peng"
  | "ming_gang"
  | "an_gang"
  | "bu_gang"
  | "hu"
  | "zimo"
  | "liang_dao"
  | "pass";

export interface LastDiscard {
  tile: TileInstance;
  playerId: PlayerId;
}

export interface ReactionOption {
  playerId: PlayerId;
  canHu: boolean;
  canPeng: boolean;
  canGang: boolean;
}

export interface PendingReactions {
  discard: LastDiscard;
  options: ReactionOption[];
}

export type FanType =
  | "base"
  | "pengpenghu"
  | "mingsiguiyi"
  | "ansiguiyi"
  | "qingyise"
  | "qidui"
  | "longqidui"
  | "shuanglongqidui"
  | "dasanyuan"
  | "xiaosanyuan"
  | "kawuxing"
  | "liangdao"
  | "gangshangkaihua"
  | "gangshangpao"
  | "qiangganghu"
  | "shouzhuayi"
  | "haidilao";

export interface FanItem {
  type: FanType;
  name: string;
  /** 当前规则中的倍率，例如 ×2/×4/×8。基础胡为 ×1。 */
  fan: number;
}

export type WinMethod = "zimo" | "discard" | "qianggang" | "gangshang";

export interface MeldGroup {
  type: "sequence" | "triplet" | "quad" | "pair";
  kind: TileKind;
  kinds: TileKind[];
}

export interface WinDecomposition {
  groups: MeldGroup[];
  isSevenPairs?: boolean;
}

export interface WinResult {
  isWin: boolean;
  decomposition?: WinDecomposition;
  allDecompositions?: WinDecomposition[];
  isSevenPairs?: boolean;
  dragonPairCount?: number;
  isPengPengHu?: boolean;
  isQingYiSe?: boolean;
  isDaSanYuan?: boolean;
  isXiaoSanYuan?: boolean;
  isKaWuXing?: boolean;
  isMingSiGuiYi?: boolean;
  isAnSiGuiYi?: boolean;
  isShouZhuaYi?: boolean;
  winningTileKind?: TileKind;
}

export interface ScoreResult {
  winnerId?: PlayerId;
  loserId?: PlayerId;
  method?: WinMethod;
  fans: FanItem[];
  totalFan: number;
  baseScore: number;
  multiplier: number;
  scoreChanges: Record<PlayerId, number>;
  totalScores: Record<PlayerId, number>;
  title: string;
}

export interface AiDecision {
  action: PlayerAction;
  tileId?: string;
  tileKind?: TileKind;
  meldId?: string;
  reason: string;
}

export interface GameState {
  wall: TileInstance[];
  deadWall: TileInstance[];
  players: Record<PlayerId, Player>;
  currentPlayerId: PlayerId;
  dealerId: PlayerId;
  phase: GamePhase;
  lastDiscard?: LastDiscard;
  pendingReactions?: PendingReactions;
  reactionPasses: PlayerId[];
  pendingBuGang?: {
    playerId: PlayerId;
    meldId: string;
    tile: TileInstance;
  };
  selectedTileId?: string;
  roundResult?: ScoreResult;
  logs: string[];
  actionNonce: number;
  canHumanLiangDao: boolean;
  supplementContext?: "gangshang";
  /** 本局已发生的杠次数，用于「杠上杠」翻倍计分 */
  gangCount: number;
}
