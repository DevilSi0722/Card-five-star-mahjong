import type {
  FanItem,
  MeldType,
  Player,
  PlayerId,
  ScoreResult,
  WinMultiplierLimit,
  WinMethod,
  WinResult,
} from "@/types/mahjong";
import { BASE_SCORE } from "./rules";

/** 杠分基础单位。规则给出的 1/2/4 分即以此为单位（设为 1 时与规则数值完全一致）。 */
export const GANG_UNIT = 1;
export const GRAND_SLAM_MULTIPLIER = 8;
export const DEFAULT_WIN_MULTIPLIER_LIMIT: WinMultiplierLimit = 8;

const FAN_META: Record<FanItem["type"], { name: string; fan: number }> = {
  base: { name: "基础胡", fan: 1 },
  pengpenghu: { name: "碰碰胡", fan: 2 },
  mingsiguiyi: { name: "明四归一", fan: 2 },
  ansiguiyi: { name: "暗四归一", fan: 4 },
  qidui: { name: "七对", fan: 4 },
  longqidui: { name: "龙七对", fan: 8 },
  shuanglongqidui: { name: "双龙七对", fan: 16 },
  dasanyuan: { name: "大三元", fan: 8 },
  xiaosanyuan: { name: "小三元", fan: 4 },
  gangshangkaihua: { name: "杠上开花", fan: 2 },
  gangshangpao: { name: "杠上炮", fan: 2 },
  qiangganghu: { name: "抢杠胡", fan: 2 },
  qingyise: { name: "清一色", fan: 4 },
  shouzhuayi: { name: "手抓一", fan: 4 },
  liangdao: { name: "亮倒/明牌", fan: 2 },
  kawuxing: { name: "卡五星", fan: 2 },
  haidilao: { name: "海底捞", fan: 2 },
};

function fan(type: FanItem["type"]): FanItem {
  return { type, ...FAN_META[type] };
}

export function multiplyFans(fans: FanItem[]): number {
  return fans.reduce((product, item) => product * item.fan, 1);
}

export function capWinMultiplier(multiplier: number, limit: WinMultiplierLimit = DEFAULT_WIN_MULTIPLIER_LIMIT): number {
  return limit === null ? multiplier : Math.min(limit, multiplier);
}

export function calculateFans(
  win: WinResult,
  options: {
    isLiangDao?: boolean;
    method: WinMethod;
    isGangShangPao?: boolean;
    isHaiDiLao?: boolean;
  },
): FanItem[] {
  const fans: FanItem[] = [fan("base")];
  if (win.isPengPengHu) fans.push(fan("pengpenghu"));
  if (win.isMingSiGuiYi) fans.push(fan("mingsiguiyi"));
  if (win.isAnSiGuiYi) fans.push(fan("ansiguiyi"));
  if (win.isQingYiSe) fans.push(fan("qingyise"));
  if (win.isSevenPairs) {
    if ((win.dragonPairCount ?? 0) >= 2) fans.push(fan("shuanglongqidui"));
    else if ((win.dragonPairCount ?? 0) === 1) fans.push(fan("longqidui"));
    else fans.push(fan("qidui"));
  }
  if (win.isDaSanYuan) fans.push(fan("dasanyuan"));
  else if (win.isXiaoSanYuan) fans.push(fan("xiaosanyuan"));
  if (options.method === "gangshang") fans.push(fan("gangshangkaihua"));
  if (options.isGangShangPao) fans.push(fan("gangshangpao"));
  if (options.method === "qianggang") fans.push(fan("qiangganghu"));
  if (win.isShouZhuaYi) fans.push(fan("shouzhuayi"));
  if (options.isLiangDao) fans.push(fan("liangdao"));
  if (win.isKaWuXing) fans.push(fan("kawuxing"));
  if (options.isHaiDiLao) fans.push(fan("haidilao"));
  return fans;
}

export function scoreWin(options: {
  players: Record<PlayerId, Player>;
  winnerId: PlayerId;
  loserId?: PlayerId;
  method: WinMethod;
  win: WinResult;
  baseScore?: number;
  maxWinMultiplier?: WinMultiplierLimit;
  isGangShangPao?: boolean;
  isHaiDiLao?: boolean;
}): ScoreResult {
  const { players, winnerId, loserId, method, win } = options;
  const scoreUnit = options.baseScore ?? BASE_SCORE;
  const fans = calculateFans(win, {
    isLiangDao: players[winnerId].isLiangDao,
    method,
    isGangShangPao: options.isGangShangPao,
    isHaiDiLao: options.isHaiDiLao,
  });
  const uncappedTotalFan = multiplyFans(fans);
  const multiplier = capWinMultiplier(
    uncappedTotalFan,
    options.maxWinMultiplier === undefined ? DEFAULT_WIN_MULTIPLIER_LIMIT : options.maxWinMultiplier,
  );
  const nonLiangDaoMultiplier = multiplyFans(fans.filter((item) => item.type !== "liangdao"));
  const isGrandSlam = nonLiangDaoMultiplier >= GRAND_SLAM_MULTIPLIER;
  const totalFan = multiplier;
  const baseScore = scoreUnit * multiplier;
  const ids = Object.keys(players) as PlayerId[];
  const scoreChanges = Object.fromEntries(ids.map((id) => [id, 0])) as Record<PlayerId, number>;
  const loserPayment = (id: PlayerId) =>
    baseScore * (!players[winnerId].isLiangDao && players[id].isLiangDao ? 2 : 1);

  if (method === "zimo" || method === "gangshang") {
    for (const id of ids) {
      if (id === winnerId) continue;
      const payment = loserPayment(id);
      scoreChanges[id] -= payment;
      scoreChanges[winnerId] += payment;
    }
  } else if (loserId) {
    const payment = loserPayment(loserId);
    scoreChanges[loserId] -= payment;
    scoreChanges[winnerId] += payment;
  }

  const totalScores = Object.fromEntries(
    ids.map((id) => [id, players[id].score + scoreChanges[id]]),
  ) as Record<PlayerId, number>;

  const methodName: Record<WinMethod, string> = {
    zimo: "自摸",
    discard: "点炮",
    qianggang: "抢杠胡",
    gangshang: "杠上开花",
  };

  return {
    winnerId,
    loserId,
    method,
    fans,
    totalFan,
    uncappedTotalFan,
    isGrandSlam,
    baseScore,
    multiplier,
    scoreChanges,
    totalScores,
    title: `${players[winnerId].name} ${methodName[method]}`,
  };
}

export function scoreDraw(players: Record<PlayerId, Player>): ScoreResult {
  const ids = Object.keys(players) as PlayerId[];
  return {
    fans: [],
    totalFan: 0,
    baseScore: 0,
    multiplier: 0,
    scoreChanges: Object.fromEntries(ids.map((id) => [id, 0])) as Record<PlayerId, number>,
    totalScores: Object.fromEntries(ids.map((id) => [id, players[id].score])) as Record<PlayerId, number>,
    title: "流局",
  };
}

/**
 * 计算一次杠的即时得分变动（杠分），并返回每位玩家的分数增量。
 *
 * 规则（每份基数 = GANG_UNIT）：
 * - 点明杠：手里 3 张，别人打出第 4 张 —— 仅点杠者赔 2 份。
 *   对应 meld 类型 `ming_gang`（需传入 fromPlayerId 作为放杠者）。
 * - 自抓明杠：先碰后自摸第 4 张补杠 —— 其余两家各赔 1 份。
 *   对应 meld 类型 `bu_gang`。
 * - 暗杠：4 张全在手 —— 其余两家各赔 2 份。
 *   对应 meld 类型 `an_gang`。
 * - 杠上杠：连杠或开杠打牌被杠时，明杠其余两家各赔 2 份，暗杠其余两家各赔 4 份（封顶）。
 */
export function scoreGang(options: {
  players: Record<PlayerId, Player>;
  gangType: MeldType;
  gangerId: PlayerId;
  /** 放杠者，仅直杠（ming_gang）需要 */
  dianGangPlayerId?: PlayerId;
  /** 是否为连杠或开杠打牌被杠。 */
  isGangContext?: boolean;
  /** 本局底分。 */
  baseScore?: number;
}): { scoreChanges: Record<PlayerId, number>; label: string; perPlayer: number } | null {
  const { players, gangType, gangerId, dianGangPlayerId, isGangContext = false } = options;
  const ids = Object.keys(players) as PlayerId[];
  const scoreChanges = Object.fromEntries(ids.map((id) => [id, 0])) as Record<PlayerId, number>;
  const scoreUnit = options.baseScore ?? GANG_UNIT;

  if (gangType === "ming_gang") {
    if (isGangContext) {
      const amount = 2 * scoreUnit;
      let total = 0;
      for (const id of ids) {
        if (id === gangerId) continue;
        scoreChanges[id] -= amount;
        total += amount;
      }
      scoreChanges[gangerId] += total;
      return { scoreChanges, label: `杠上明杠 +${total}`, perPlayer: amount };
    }
    // 点明杠：点杠者单独赔 2 份
    if (!dianGangPlayerId) return null;
    const amount = 2 * scoreUnit;
    scoreChanges[dianGangPlayerId] -= amount;
    scoreChanges[gangerId] += amount;
    return { scoreChanges, label: `点明杠 +${amount}`, perPlayer: amount };
  }

  if (gangType === "bu_gang") {
    // 自抓明杠；杠上杠时封顶为其余两家各赔 2 份
    const amount = (isGangContext ? 2 : 1) * scoreUnit;
    let total = 0;
    for (const id of ids) {
      if (id === gangerId) continue;
      scoreChanges[id] -= amount;
      total += amount;
    }
    scoreChanges[gangerId] += total;
    return { scoreChanges, label: `${isGangContext ? "杠上明杠" : "自抓明杠"} +${total}`, perPlayer: amount };
  }

  if (gangType === "an_gang") {
    // 暗杠；杠上杠时封顶为其余两家各赔 4 份
    const amount = (isGangContext ? 4 : 2) * scoreUnit;
    let total = 0;
    for (const id of ids) {
      if (id === gangerId) continue;
      scoreChanges[id] -= amount;
      total += amount;
    }
    scoreChanges[gangerId] += total;
    return { scoreChanges, label: `${isGangContext ? "杠上暗杠" : "暗杠"} +${total}`, perPlayer: amount };
  }

  return null;
}

/** 把杠分增量应用到玩家分数上。 */
export function applyGangScore(
  players: Record<PlayerId, Player>,
  scoreChanges: Record<PlayerId, number>,
): Record<PlayerId, Player> {
  const ids = Object.keys(players) as PlayerId[];
  return Object.fromEntries(
    ids.map((id) => [id, { ...players[id], score: players[id].score + scoreChanges[id] }]),
  ) as Record<PlayerId, Player>;
}
