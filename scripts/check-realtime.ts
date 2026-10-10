import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { io, type Socket } from "socket.io-client";
import type { GuestActionInput, NetGameView, Room } from "@/types/multiplayer";
import type { RealtimeResult, RealtimeSession } from "@/types/realtime";
import { actionContext, applySyncPacket, compactView, expandView, syncPacket, SYNC_PROTOCOL, type CompactView, type GameSyncPacket } from "@/lib/multiplayer/syncProtocol";
import { createFaultProxy } from "./realtime-fault-proxy";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sockets: Socket[] = [];
const views = new Map<Socket, NetGameView>();
const rooms = new Map<Socket, Room>();
const baselines = new Map<Socket, CompactView>();
const packetKinds = new Set<string>();
const dropNextPatch = new Set<Socket>();
let gapsRecovered = 0;
let child: ChildProcess | undefined;

async function checkBrowserClient(url: string, guest: Socket) {
  const proxy = await createFaultProxy(url);
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } } });
  process.env.NEXT_PUBLIC_REALTIME_URL = proxy.url;
  const client = await import("@/lib/multiplayer/realtimeClient");
  let current: NetGameView | undefined;
  const unsubscribe = client.subscribeGameView((view) => { current = view; });
  const settings = { rounds: 4, baseScore: 1, maxWinMultiplier: 8 as const, liangDaoZimoBuyHorse: false };
  try {
    proxy.controls.blockWebSocket = true;
    await client.createRealtimeRoom({ clientId: "fallback-" + Date.now(), name: "Fallback", settings });
    assert(proxy.stats.blockedUpgrades > 0 && proxy.stats.pollingRequests > 0, "WebSocket-first falls back to polling");
    await client.leaveRealtimeRoom();
    client.clearRealtimeSession();
    proxy.controls.blockWebSocket = false;
    const session = await client.createRealtimeRoom({ clientId: "fault-host-" + Date.now(), name: "FaultHost", settings });
    await success(guest, "room:join", { code: session.room.code, clientId: "fault-guest-" + Date.now(), name: "FaultGuest" });
    await client.startRealtimeGame();
    await until(() => current?.state.phase === "playing", "real client receives initial snapshot");
    await until(() => client.getRealtimeConnection().latencyMs !== null, "application RTT measurement");
    const tile = current!.state.players.human.hand[0];
    assert.equal((await guest.timeout(5_000).emitWithAck("realtime:ping")).data.roomCode, session.room.code);
    proxy.controls.dropActionAck = true;
    const pendingAction = client.sendRealtimeAction({ type: "discard", tileId: tile.id });
    await until(() => proxy.stats.droppedAcks === 1, "drop action acknowledgement");
    const seat = current!.forSeat;
    proxy.interrupt();
    await until(() => client.getRealtimeConnection().status !== "connected", "client detects transport loss");
    await assert.rejects(client.sendRealtimeAction({ type: "pass" }), /正在重连/);
    await until(() => client.getRealtimeConnection().status === "connected", "automatic identity and state recovery");
    await pendingAction;
    assert(!current!.state.players.human.hand.some((entry) => entry.id === tile.id));
    assert.equal(client.loadRealtimeSession()?.sessionToken, session.sessionToken);
    assert.equal(current!.forSeat, seat);
    proxy.controls.dropPatch = true;
    const deadline = Date.now() + 25_000;
    while (proxy.stats.resyncRequests === 0 && Date.now() < deadline) {
      for (const [view, act] of [
        [current, (action: Omit<GuestActionInput, "seat">) => client.sendRealtimeAction(action)],
        [views.get(guest), (action: Omit<GuestActionInput, "seat">) => success(guest, "game:action", action)],
      ] as const) {
        if (!view) continue;
        const state = view.state;
        try {
          if (state.phase === "playing" && state.currentPlayerId === "human") {
            await act({ type: "discard", tileId: state.players.human.hand[0].id });
          } else if (state.phase === "responding" && state.pendingReactions?.options.some((option) => option.playerId === "human")
            && !state.reactionPasses.includes("human")) await act({ type: "pass" });
        } catch { /* Faults may make an action stale; the authoritative state must repair it. */ }
      }
      await delay(100);
    }
    assert.equal(proxy.stats.droppedPatches, 1);
    assert(proxy.stats.resyncRequests > 0, "real client requests a full baseline after a lost patch");
    await until(() => current?.rev === views.get(guest)?.rev, "views converge after resync");
    await client.leaveRealtimeRoom();
    client.clearRealtimeSession();
    const closingRoom = await success<RealtimeSession>(guest, "room:create", {
      clientId: "closing-host-" + Date.now(), name: "ClosingHost", settings,
    });
    await client.joinRealtimeRoom({ code: closingRoom.room.code, clientId: "closing-guest-" + Date.now(), name: "ClosingGuest" });
    await success(guest, "room:start");
    await until(() => current?.roomCode === closingRoom.room.code && current?.state.phase === "playing", "heartbeat test room starts");
    const previousResyncs = proxy.stats.resyncRequests;
    proxy.controls.dropAllPatches = true;
    await success(guest, "game:action", { type: "discard", tileId: views.get(guest)!.state.players.human.hand[0].id });
    await until(() => proxy.stats.resyncRequests > previousResyncs, "heartbeat detects missed final updates without new input");
    proxy.controls.dropAllPatches = false;
    await until(() => current?.rev === views.get(guest)?.rev, "heartbeat restores current state");
    proxy.interrupt();
    await until(() => client.getRealtimeConnection().status !== "connected", "disconnect before room is closed");
    await success(guest, "room:leave");
    await until(() => !client.loadRealtimeSession(), "expired session is cleared after reconnect");
    console.log("PASS real client: WebSocket fallback, dropped-ack retry across reconnect, offline input, missing-patch and idle heartbeat recovery, closed session, leave acknowledgement");
  } finally {
    unsubscribe();
    client.clearRealtimeSession();
    delete process.env.NEXT_PUBLIC_REALTIME_URL;
    Reflect.deleteProperty(globalThis, "window");
    await proxy.close();
  }
}

async function until(predicate: () => unknown | Promise<unknown>, description: string, timeout = 15_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await delay(50);
  }
  throw new Error("Timed out: " + description);
}

async function ack<T = unknown>(socket: Socket, event: string, ...args: unknown[]): Promise<RealtimeResult<T>> {
  if (event === "game:action" && socket.auth && (socket.auth as Record<string, unknown>).syncProtocol === SYNC_PROTOCOL) {
    const view = views.get(socket)!;
    args[0] = { ...(args[0] as object), actionId: crypto.randomUUID(), round: view.round,
      context: view.actionContext ?? actionContext(view.state, view.round!) };
  }
  return socket.timeout(5_000).emitWithAck(event, ...args);
}

async function success<T = unknown>(socket: Socket, event: string, ...args: unknown[]): Promise<T> {
  const result = await ack<T>(socket, event, ...args);
  assert.equal(result.ok, true, JSON.stringify(result));
  return (result as { ok: true; data: T }).data;
}

async function connect(url: string, transports = ["polling", "websocket"], protocol = SYNC_PROTOCOL) {
  const socket = io(url, { transports, reconnection: false, auth: { syncProtocol: protocol }, extraHeaders: { Origin: "https://kwx.dscode.win" } });
  sockets.push(socket);
  socket.on("game:view", (view) => views.set(socket, view));
  socket.on("room:update", (room) => rooms.set(socket, room));
  socket.on("game:sync", (packet: GameSyncPacket) => {
    packetKinds.add(packet.kind);
    if (packet.kind === "patch" && dropNextPatch.delete(socket)) return;
    const next = applySyncPacket(baselines.get(socket), packet);
    if (!next) {
      gapsRecovered += 1;
      socket.timeout(5_000).emit("game:resync", () => {});
      return;
    }
    baselines.set(socket, next);
    views.set(socket, expandView(next));
  });
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
  if (process.argv.includes("--client-only")) {
    await checkBrowserClient(url, await connect(url, ["websocket"]));
    return;
  }
  const host = await connect(url);
  const guest = await connect(url, ["websocket"]);
  const third = await connect(url, ["polling"], 1);
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
  const initialView = views.get(host)!;
  const compact = compactView(initialView);
  const fullBytes = Buffer.byteLength(JSON.stringify(initialView));
  const compactBytes = Buffer.byteLength(JSON.stringify(syncPacket(compact)));
  assert(compactBytes < fullBytes * 0.6, "compact snapshot removes hidden tile arrays");
  console.log(`PASS compact full snapshot ${fullBytes} -> ${compactBytes} bytes (${Math.round(100 * (1 - compactBytes / fullBytes))}% smaller)`);
  const cleared = compactView({ ...initialView, rev: initialView.rev + 1,
    state: { ...initialView.state, lastDiscard: undefined, actionAnnouncement: undefined,
      pendingReactions: undefined, pendingBuGang: undefined, roundResult: undefined } });
  const withOptionals = compactView({ ...initialView, state: { ...initialView.state,
    lastDiscard: { playerId: "human", tile: initialView.state.players.human.hand[0] } } });
  const clearingPatch = syncPacket(cleared, withOptionals);
  const recovered = applySyncPacket(withOptionals, clearingPatch)!;
  assert.equal(expandView(recovered).state.lastDiscard, undefined, "patch clears optional fields");
  if (clearingPatch.kind === "patch") assert.equal(applySyncPacket(undefined, clearingPatch), undefined);
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

  const acting = [host, guest, third].find((client) => views.get(client)?.state.currentPlayerId === "human")!;
  const actorView = views.get(acting)!;
  const envelope = { type: "discard", tileId: actorView.state.players.human.hand[0].id,
    actionId: crypto.randomUUID(), round: actorView.round, context: actorView.actionContext };
  const first = await acting.timeout(5_000).emitWithAck("game:action", envelope);
  assert.equal(first.ok, true);
  // Model a lost acknowledgement: retry the identical request after the state has advanced.
  const repeated = await acting.timeout(5_000).emitWithAck("game:action", envelope);
  assert.deepEqual(repeated, first, "retries return the original receipt");
  assert.equal((await acting.timeout(5_000).emitWithAck("game:action", { ...envelope, type: "hu" })).ok, false);
  assert.equal((await acting.timeout(5_000).emitWithAck("game:action", { ...envelope, actionId: crypto.randomUUID() })).ok, false,
    "stale context is rejected");
  assert.equal((await guest.timeout(5_000).emitWithAck("game:action", { type: "discard", tileId: "missing" })).ok, false);
  assert.equal((await ack(third, "game:action", { type: "discard", tileId: "missing-tile" })).ok, false, "ignored engine action must not acknowledge success");
  dropNextPatch.add(guest);
  console.log("PASS lost-ack deduplication, conflicting IDs, stale actions, invalid actions");

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
          const result = await ack(player, "game:action", { type: "discard", tileId: tile.id });
          if (result.ok) discards += 1;
          else assert.match(result.error, /牌局已更新|不符合牌局规则/);
        }
      }
    } else if (state.phase === "responding") {
      for (const player of [host, guest, third]) {
        const view = views.get(player)!;
        if (view.state.pendingReactions?.options.some((option) => option.playerId === "human") && !view.state.reactionPasses.includes("human")) {
          const result = await ack(player, "game:action", { type: "pass" });
          // Another player may have resolved this reaction while its request was in flight.
          if (!result.ok) assert.match(result.error, /牌局已更新|不符合牌局规则/);
        }
      }
    }
    await delay(100);
  }
  assert(["settled", "draw"].includes(views.get(host)!.state.phase), "round must finish");
  assert(discards > 10, "round progressed through human turns");
  assert(packetKinds.has("patch"), "incremental packets were used");
  assert(gapsRecovered > 0, "a deliberately missed patch triggered full resynchronization");
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
  if (process.argv[2] === "--self-test") await checkBrowserClient(url, guest);
  const health = await (await fetch(url + (url.includes("18140") || url.startsWith("https:") ? "/_health/realtime" : "/health"))).json();
  assert(health.sync.actionsRetried > 0);
  assert(health.sync.patchPackets > 0);
  console.log("SYNC METRICS " + JSON.stringify(health.sync));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  sockets.forEach((socket) => socket.disconnect());
  child?.kill("SIGTERM");
});
