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
  qingyise: { name: "清一色", fan: 3 },
  qidui: { name: "七对", fan: 3 },
  dasanyuan: { name: "大三元", fan: 4 },
  xiaosanyuan: { name: "小三元", fan: 3 },
  kawuxing: { name: "卡五星", fan: 2 },
  liangdao: { name: "亮倒/明牌", fan: 1 },
  gangshangkaihua: { name: "杠上开花", fan: 1 },
  qiangganghu: { name: "抢杠胡", fan: 1 },
};

function fan(type: FanItem["type"]): FanItem {
  return { type, ...FAN_META[type] };
}

export function calculateFans(
  win: WinResult,
  options: {
    isLiangDao?: boolean;
    method: WinMethod;
  },
): FanItem[] {
  const fans: FanItem[] = [fan("base")];
  if (win.isPengPengHu) fans.push(fan("pengpenghu"));
  if (win.isQingYiSe) fans.push(fan("qingyise"));
  if (win.isSevenPairs) fans.push(fan("qidui"));
  if (win.isDaSanYuan) fans.push(fan("dasanyuan"));
  else if (win.isXiaoSanYuan) fans.push(fan("xiaosanyuan"));
  if (win.isKaWuXing) fans.push(fan("kawuxing"));
  if (options.isLiangDao) fans.push(fan("liangdao"));
  if (options.method === "gangshang") fans.push(fan("gangshangkaihua"));
  if (options.method === "qianggang") fans.push(fan("qiangganghu"));
  return fans;
}

export function scoreWin(options: {
  players: Record<PlayerId, Player>;
  winnerId: PlayerId;
  loserId?: PlayerId;
  method: WinMethod;
  win: WinResult;
}): ScoreResult {
  const { players, winnerId, loserId, method, win } = options;
  const fans = calculateFans(win, {
    isLiangDao: players[winnerId].isLiangDao,
    method,
  });
  const totalFan = fans.reduce((sum, item) => sum + item.fan, 0);
  const baseScore = BASE_SCORE * 2 ** totalFan;
  const ids = Object.keys(players) as PlayerId[];
  const scoreChanges = Object.fromEntries(ids.map((id) => [id, 0])) as Record<PlayerId, number>;

  if (method === "zimo" || method === "gangshang") {
    for (const id of ids) {
      if (id === winnerId) continue;
      scoreChanges[id] -= baseScore;
      scoreChanges[winnerId] += baseScore;
    }
  } else if (loserId) {
    scoreChanges[loserId] -= baseScore;
    scoreChanges[winnerId] += baseScore;
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
}): { scoreChanges: Record<PlayerId, number>; label: string; perPlayer: number } | null {
  const { players, gangType, gangerId, dianGangPlayerId, gangSequence } = options;
  const ids = Object.keys(players) as PlayerId[];
  const scoreChanges = Object.fromEntries(ids.map((id) => [id, 0])) as Record<PlayerId, number>;
  const multiplier = 2 ** Math.max(0, gangSequence - 1);

  if (gangType === "ming_gang") {
    // 直杠（点杠）：放杠者单独赔 2 份
    if (!dianGangPlayerId) return null;
    const amount = 2 * GANG_UNIT * multiplier;
    scoreChanges[dianGangPlayerId] -= amount;
    scoreChanges[gangerId] += amount;
    return { scoreChanges, label: `直杠 +${amount}`, perPlayer: amount };
  }

  if (gangType === "bu_gang") {
    // 明杠（蓄杠）：其余两家各赔 1 份
    const amount = 1 * GANG_UNIT * multiplier;
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
    const amount = 2 * GANG_UNIT * multiplier;
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
