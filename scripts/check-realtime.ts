import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { io, type Socket } from "socket.io-client";
import type { NetGameView, Room } from "@/types/multiplayer";
import type { RealtimeResult, RealtimeSession } from "@/types/realtime";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sockets: Socket[] = [];
const views = new Map<Socket, NetGameView>();
const rooms = new Map<Socket, Room>();
let child: ChildProcess | undefined;

async function until(predicate: () => unknown | Promise<unknown>, description: string, timeout = 15_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await delay(50);
  }
  throw new Error("Timed out: " + description);
}

async function ack<T = unknown>(socket: Socket, event: string, ...args: unknown[]): Promise<RealtimeResult<T>> {
  return socket.timeout(5_000).emitWithAck(event, ...args);
}

async function success<T = unknown>(socket: Socket, event: string, ...args: unknown[]): Promise<T> {
  const result = await ack<T>(socket, event, ...args);
  assert.equal(result.ok, true, JSON.stringify(result));
  return (result as { ok: true; data: T }).data;
}

async function connect(url: string, transports = ["polling", "websocket"]) {
  const socket = io(url, { transports, reconnection: false, extraHeaders: { Origin: "https://kwx.dscode.win" } });
  sockets.push(socket);
  socket.on("game:view", (view) => views.set(socket, view));
  socket.on("room:update", (room) => rooms.set(socket, room));
  await until(() => socket.connected, "connect " + transports.join("/"));
  return socket;
}

async function main() {
  let url = process.argv[2] || "http://127.0.0.1:18140";
  if (url === "--self-test") {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert(address && typeof address !== "string");
    const port = address.port;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    url = "http://127.0.0.1:" + port;
    child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
      env: { ...process.env, REALTIME_PORT: String(port), REALTIME_HOST: "127.0.0.1", CORS_ORIGIN: "https://kwx.dscode.win" },
      stdio: ["ignore", "inherit", "inherit"],
    });
    await until(async () => {
      try { return (await fetch(url + "/health")).ok; }
      catch { return false; }
    }, "self-test service startup");
  }
  const host = await connect(url);
  const guest = await connect(url, ["websocket"]);
  const third = await connect(url, ["polling"]);
  const settings = { rounds: 4, baseScore: 1, maxWinMultiplier: 8, liangDaoZimoBuyHorse: false };
  const hostSession = await success<RealtimeSession>(host, "room:create", { clientId: "test-host-" + Date.now(), name: "CheckHost", settings });
  const code = hostSession.room.code;
  assert.equal((await ack(host, "room:start")).ok, false);
  const guestId = "test-guest-" + Date.now();
  const guestSession = await success<RealtimeSession>(guest, "room:join", { code, clientId: guestId, name: "CheckGuest" });
  await success(third, "room:join", { code, clientId: "test-third-" + Date.now(), name: "CheckThird" });
  await until(() => rooms.get(host)?.players.length === 3, "three player roster");
  assert.equal((await ack(guest, "room:start")).ok, false);
  assert.equal((await ack(guest, "room:choose-wind", "invalid")).ok, false);
  assert.equal((await ack(guest, "room:create", null)).ok, false);
  assert.equal((await ack(guest, "room:chat", { bad: true })).ok, false);
  guest.emit("room:create", null);
  await success(host, "room:start");
  await until(() => [host, guest, third].every((socket) => views.get(socket)?.state.phase === "playing"), "dealing complete");
  await until(() => host.io.engine.transport.name === "websocket", "polling to WebSocket upgrade");
  for (const socket of [host, guest, third]) {
    const state = views.get(socket)!.state;
    assert(state.players.human.hand.every((tile) => !tile.id.startsWith("hidden:")));
    assert(state.players.ai_left.hand.every((tile) => tile.id.startsWith("hidden:")));
    assert(state.players.ai_right.hand.every((tile) => tile.id.startsWith("hidden:")));
    assert(state.wall.every((tile) => tile.id.startsWith("hidden:")));
  }
  await success(guest, "room:chat", "Hello");
  await until(() => rooms.get(host)?.quickChat?.text === "Hello", "chat broadcast");
  const beforeReconnect = views.get(guest)!.forSeat;
  guest.disconnect();
  await delay(150);
  views.delete(guest);
  guest.connect();
  await until(() => guest.connected, "guest reconnect transport");
  const resumed = await success<RealtimeSession>(guest, "room:join", { code, clientId: guestId, name: "CheckGuest", sessionToken: guestSession.sessionToken });
  assert.equal(resumed.sessionToken, guestSession.sessionToken);
  await until(() => views.has(guest), "guest restored view");
  assert.equal(views.get(guest)!.forSeat, beforeReconnect);
  console.log("PASS three players, permissions, malformed requests, privacy, chat, polling/WebSocket, reconnect");

  const deadline = Date.now() + 150_000;
  let discards = 0;
  while (Date.now() < deadline) {
    const state = views.get(host)!.state;
    if (state.phase === "settled" || state.phase === "draw") break;
    if (state.phase === "playing") {
      const player = [host, guest, third].find((socket) => views.get(socket)?.state.currentPlayerId === "human");
      if (player) {
        const view = views.get(player)!;
        const tile = view.state.players.human.hand[0];
        if (tile) {
          await success(player, "game:action", { type: "discard", tileId: tile.id });
          discards += 1;
        }
      }
    } else if (state.phase === "responding") {
      for (const player of [host, guest, third]) {
        const view = views.get(player)!;
        if (view.state.pendingReactions?.options.some((option) => option.playerId === "human") && !view.state.reactionPasses.includes("human")) {
          await success(player, "game:action", { type: "pass" });
        }
      }
    }
    await delay(100);
  }
  assert(["settled", "draw"].includes(views.get(host)!.state.phase), "round must finish");
  assert(discards > 10, "round progressed through human turns");
  for (const player of [host, guest, third]) await success(player, "room:ready", 1);
  await until(() => rooms.get(host)?.currentRound === 2 && views.get(guest)?.round === 2, "second round");
  await success(host, "room:leave");
  console.log("PASS complete round, settlement, all-player readiness, second round, room cleanup");

  const aiHost = await success<RealtimeSession>(host, "room:create", { clientId: "ai-host-" + Date.now(), name: "AIHost", settings });
  await success(guest, "room:join", { code: aiHost.room.code, clientId: "ai-guest-" + Date.now(), name: "AIGuest" });
  await success(host, "room:start");
  await until(() => rooms.get(host)?.players.some((player) => player.isAi), "AI fills empty seat");
  await until(() => views.get(host)?.state.phase === "playing", "AI game starts");
  await success(host, "room:leave");
  console.log("PASS two players with AI; realtime acceptance checks completed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  sockets.forEach((socket) => socket.disconnect());
  child?.kill("SIGTERM");
});
