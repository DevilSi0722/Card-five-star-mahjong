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
  liangDaoHiddenTileIds: string[];
  lastDrawnTileId?: string;
}

export type GamePhase =
  | "ready"
  | "rolling"
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

export type WinMultiplierLimit = 8 | 16 | 32 | 64 | null;

export interface AnnouncementBadge {
  playerId: PlayerId;
  text: string;
  tone: "winner" | "loser";
}

export interface ActionAnnouncement {
  id: number;
  badges: AnnouncementBadge[];
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
  nextDealerId?: PlayerId;
  method?: WinMethod;
  fans: FanItem[];
  totalFan: number;
  uncappedTotalFan?: number;
  isGrandSlam?: boolean;
  baseScore: number;
  multiplier: number;
  scoreChanges: Record<PlayerId, number>;
  totalScores: Record<PlayerId, number>;
  title: string;
  buyHorse?: {
    tile: TileInstance;
    value: number;
    bonus: number;
    items?: {
      tile: TileInstance;
      value: number;
      bonus: number;
    }[];
    totalValue?: number;
    isBuyOneGetOne?: boolean;
  };
  winDetails?: WinScoreDetail[];
  winningHands?: WinHandSnapshot[];
}

export interface WinScoreDetail {
  winnerId: PlayerId;
  loserId?: PlayerId;
  method: WinMethod;
  fans: FanItem[];
  totalFan: number;
  uncappedTotalFan?: number;
  isGrandSlam?: boolean;
  baseScore: number;
  multiplier: number;
  title: string;
}

export interface WinHandSnapshot {
  playerId: PlayerId;
  tiles: TileInstance[];
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
  /** 开局起牌时，各玩家当前已展示的手牌数量。 */
  dealRevealCounts: Record<PlayerId, number>;
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
  /** 本局开始时的累计分，用于把杠分、胡牌、买马合并成完整的本局得分。 */
  roundStartScores: Record<PlayerId, number>;
  /** 本局中途即时结算的计分说明，例如杠分。 */
  roundScoreNotes: Record<PlayerId, string[]>;
  /** 最近一次碰/杠/亮倒文字特效事件。 */
  actionAnnouncement?: ActionAnnouncement;
  logs: string[];
  actionNonce: number;
  canHumanLiangDao: boolean;
  supplementContext?: "gangshang";
  /** 兼容保留字段；杠分不再按本局杠次数翻倍。 */
  gangCount: number;
  /** 本局底分。 */
  baseScore: number;
  /** 下一局底分。 */
  nextBaseScore: number;
  /** 本局胡牌最大倍率；null 表示无限制。 */
  maxWinMultiplier: WinMultiplierLimit;
  /** 下一局胡牌最大倍率；null 表示无限制。 */
  nextMaxWinMultiplier: WinMultiplierLimit;
  /** 可选拓展玩法：亮倒后自摸胡牌触发买马。 */
  liangDaoZimoBuyHorseEnabled: boolean;
  /** 下一局是否启用「亮倒自摸买马」。 */
  nextLiangDaoZimoBuyHorseEnabled: boolean;
}
