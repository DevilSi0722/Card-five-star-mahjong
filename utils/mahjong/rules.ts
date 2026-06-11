import type { PlayerId } from "@/types/mahjong";
import { PLAYER_ORDER, nextPlayerId, orderedAfter } from "./tiles";

export const BASE_SCORE = 1;
export const INITIAL_SCORE = 0;
export const AI_DELAY_MIN = 500;
export const AI_DELAY_MAX = 1000;

export function getNextPlayerId(playerId: PlayerId): PlayerId {
  return nextPlayerId(PLAYER_ORDER, playerId);
}

export function getPlayersAfter(playerId: PlayerId): PlayerId[] {
  return orderedAfter(PLAYER_ORDER, playerId);
}

export function actionDelay(): number {
  return AI_DELAY_MIN + Math.floor(Math.random() * (AI_DELAY_MAX - AI_DELAY_MIN + 1));
}
