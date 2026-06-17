import type { WinMultiplierLimit } from "@/types/mahjong";

export const WIN_MULTIPLIER_LIMIT_OPTIONS: WinMultiplierLimit[] = [8, 16, 32, 64, null];

export function formatWinMultiplierLimit(limit: WinMultiplierLimit): string {
  return limit === null ? "无限制" : `${limit}倍`;
}
