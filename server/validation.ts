const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === "string" && value.length > 0 && value.length <= max;
const optionalText = (value: unknown, max: number) => value === undefined || text(value, max);
const winds = ["east", "south", "west", "north"];
const actions = ["discard", "peng", "ming_gang", "an_gang", "bu_gang", "liang_dao", "hu", "pass"];

function settings(value: unknown) {
  return isRecord(value)
    && [1, 4, 8, 16, null].includes(value.rounds as number | null)
    && typeof value.baseScore === "number" && Number.isSafeInteger(value.baseScore) && value.baseScore >= 1
    && [8, 16, 32, 64, null].includes(value.maxWinMultiplier as number | null)
    && typeof value.liangDaoZimoBuyHorse === "boolean";
}

export function validateEvent(event: string, args: unknown[]) {
  const value = args[0];
  if (["room:start", "room:leave", "game:resync", "realtime:ping"].includes(event)) return args.length === 0;
  if (args.length !== 1) return false;
  switch (event) {
    case "room:create":
      return isRecord(value) && text(value.clientId, 128) && typeof value.name === "string" && value.name.length <= 100
        && optionalText(value.code, 4) && settings(value.settings);
    case "room:join":
      return isRecord(value) && text(value.clientId, 128) && typeof value.name === "string" && value.name.length <= 100
        && typeof value.code === "string" && /^\d{4}$/.test(value.code) && optionalText(value.sessionToken, 128);
    case "room:choose-wind":
      return typeof value === "string" && winds.includes(value);
    case "room:update-settings":
      return settings(value);
    case "room:ready":
      return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
    case "room:chat":
      return text(value, 100);
    case "game:action":
      return isRecord(value) && typeof value.type === "string" && actions.includes(value.type)
        && (value.actionId === undefined && value.round === undefined && value.context === undefined
          || (text(value.actionId, 128) && Number.isSafeInteger(value.round) && (value.round as number) >= 1 && text(value.context, 256)))
        && (!["discard", "liang_dao"].includes(value.type) || text(value.tileId, 128))
        && (value.type !== "an_gang" || text(value.tileKind, 32))
        && (value.type !== "bu_gang" || text(value.meldId, 128))
        && optionalText(value.tileId, 128) && optionalText(value.meldId, 128)
        && (value.tileKind === undefined || (typeof value.tileKind === "string" && /^(dot-[1-9]|bamboo-[1-9]|dragon-(red|green|white))$/.test(value.tileKind)));
    default:
      return false;
  }
}
