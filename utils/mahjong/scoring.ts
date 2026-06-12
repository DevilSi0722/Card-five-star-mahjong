import type {
  FanItem,
  MeldType,
  Player,
  PlayerId,
  ScoreResult,
  WinMethod,
  WinResult,
} from "@/types/mahjong";
import { BASE_SCORE } from "./rules";

/** 杠分基础单位。规则给出的 1/2/4 分即以此为单位（设为 1 时与规则数值完全一致）。 */
export const GANG_UNIT = 1;

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
  const multiplier = fans.reduce((product, item) => product * item.fan, 1);
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
 * 规则（每份基数 = GANG_UNIT，按「杠上杠」翻倍）：
 * - 直杠（点杠）：手里 3 张，别人打出第 4 张 —— 仅放杠者赔 2 份，杠者得 2 份。
 *   对应 meld 类型 `ming_gang`（需传入 fromPlayerId 作为放杠者）。
 * - 明杠（蓄杠）：先碰后自摸第 4 张补杠 —— 其余两家各赔 1 份，杠者共得 2 份。
 *   对应 meld 类型 `bu_gang`。
 * - 暗杠：4 张全在手 —— 其余两家各赔 2 份，杠者共得 4 份。
 *   对应 meld 类型 `an_gang`。
 *
 * gangSequence 为本次杠是本局第几次杠（从 1 开始）；第 2 次起每次翻倍：
 * 倍数 = 2 ** (gangSequence - 1)。
 */
export function scoreGang(options: {
  players: Record<PlayerId, Player>;
  gangType: MeldType;
  gangerId: PlayerId;
  /** 放杠者，仅直杠（ming_gang）需要 */
  dianGangPlayerId?: PlayerId;
  /** 本局第几次杠，从 1 开始 */
  gangSequence: number;
  /** 本局底分。 */
  baseScore?: number;
}): { scoreChanges: Record<PlayerId, number>; label: string; perPlayer: number } | null {
  const { players, gangType, gangerId, dianGangPlayerId, gangSequence } = options;
  const ids = Object.keys(players) as PlayerId[];
  const scoreChanges = Object.fromEntries(ids.map((id) => [id, 0])) as Record<PlayerId, number>;
  const multiplier = 2 ** Math.max(0, gangSequence - 1);
  const scoreUnit = options.baseScore ?? GANG_UNIT;

  if (gangType === "ming_gang") {
    // 直杠（点杠）：放杠者单独赔 2 份
    if (!dianGangPlayerId) return null;
    const amount = 2 * scoreUnit * multiplier;
    scoreChanges[dianGangPlayerId] -= amount;
    scoreChanges[gangerId] += amount;
    return { scoreChanges, label: `直杠 +${amount}`, perPlayer: amount };
  }

  if (gangType === "bu_gang") {
    // 明杠（蓄杠）：其余两家各赔 1 份
    const amount = 1 * scoreUnit * multiplier;
    let total = 0;
    for (const id of ids) {
      if (id === gangerId) continue;
      scoreChanges[id] -= amount;
      total += amount;
    }
    scoreChanges[gangerId] += total;
    return { scoreChanges, label: `明杠 +${total}`, perPlayer: amount };
  }

  if (gangType === "an_gang") {
    // 暗杠：其余两家各赔 2 份
    const amount = 2 * scoreUnit * multiplier;
    let total = 0;
    for (const id of ids) {
      if (id === gangerId) continue;
      scoreChanges[id] -= amount;
      total += amount;
    }
    scoreChanges[gangerId] += total;
    return { scoreChanges, label: `暗杠 +${total}`, perPlayer: amount };
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
