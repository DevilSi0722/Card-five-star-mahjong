import type { EngineSeatId, RoomPlayer, Wind } from "@/types/multiplayer";

/**
 * 风位与引擎座位的映射。
 *
 * 现实约定（固定罗盘）：上北、下南、左西、右东，桌子不动。
 * 每个玩家把自己的风位转到底部观察，于是：
 *   - 顺时针方向（右→下→左→上 即 东→南→西→北）最近的「已占风位」落在自己【左】侧；
 *   - 逆时针方向最近的「已占风位」落在自己【右】侧。
 *
 * 例（玩家1东、玩家2北、玩家3南）：东的右邻=北、左邻=南，与预期一致。
 *
 * 引擎仅有三个座位（human=底/自己、ai_right=右、ai_left=左），没有「对门」座位，
 * 因此第四个风位始终空缺，三个已占风位通过上面的左右邻规则收敛到三个座位上。
 */

// 顺时针罗盘顺序：右(东) → 下(南) → 左(西) → 上(北)
const WIND_CLOCKWISE: Wind[] = ["east", "south", "west", "north"];

function cwIndex(wind: Wind): number {
  return WIND_CLOCKWISE.indexOf(wind);
}

/** 从 from 出发，顺时针方向最近的已占风位（不含 from）。 */
function nearestClockwise(from: Wind, occupied: Set<Wind>): Wind | null {
  for (let step = 1; step <= WIND_CLOCKWISE.length; step += 1) {
    const wind = WIND_CLOCKWISE[(cwIndex(from) + step) % WIND_CLOCKWISE.length];
    if (occupied.has(wind)) return wind;
  }
  return null;
}

/** 从 from 出发，逆时针方向最近的已占风位（不含 from）。 */
function nearestCounterClockwise(from: Wind, occupied: Set<Wind>): Wind | null {
  const n = WIND_CLOCKWISE.length;
  for (let step = 1; step <= n; step += 1) {
    const wind = WIND_CLOCKWISE[(cwIndex(from) - step + n * step) % n];
    if (occupied.has(wind)) return wind;
  }
  return null;
}

/**
 * 以房主（恒为引擎 human 座位）的风位为基准，把三名玩家映射到三个引擎座位：
 *   human    = 房主
 *   ai_right = 房主逆时针最近的玩家（视觉右侧）
 *   ai_left  = 房主顺时针最近的玩家（视觉左侧）
 * 入参需恰好 3 名玩家且含房主，否则返回 null。
 */
export function resolveEngineSeats(players: RoomPlayer[]): Record<EngineSeatId, RoomPlayer> | null {
  if (players.length !== 3) return null;
  const host = players.find((p) => p.isHost);
  if (!host) return null;

  const occupied = new Set(players.map((p) => p.wind));
  const rightWind = nearestCounterClockwise(host.wind, occupied);
  const leftWind = nearestClockwise(host.wind, occupied);
  if (!rightWind || !leftWind) return null;

  const byWind = (wind: Wind) => players.find((p) => p.wind === wind);
  const right = byWind(rightWind);
  const left = byWind(leftWind);
  if (!right || !left) return null;

  return { human: host, ai_right: right, ai_left: left };
}

/** 找出某 clientId 在引擎中占用的座位；解析不出则返回 null。 */
export function engineSeatForClient(players: RoomPlayer[], clientId: string): EngineSeatId | null {
  const seats = resolveEngineSeats(players);
  if (!seats) return null;
  const entry = (Object.keys(seats) as EngineSeatId[]).find((seat) => seats[seat].clientId === clientId);
  return entry ?? null;
}

/** 各引擎座位对应的风位（host 视角的真实座位→风位）。 */
export function engineSeatWinds(players: RoomPlayer[]): Record<EngineSeatId, Wind> | null {
  const seats = resolveEngineSeats(players);
  if (!seats) return null;
  return {
    human: seats.human.wind,
    ai_right: seats.ai_right.wind,
    ai_left: seats.ai_left.wind,
  };
}
