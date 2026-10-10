import { createServer } from "node:http";
import { Server } from "socket.io";
import { RoomManager } from "./roomManager";
import { validateEvent } from "./validation";
import { SYNC_PROTOCOL } from "@/lib/multiplayer/syncProtocol";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/types/realtime";

const port = Number.parseInt(process.env.REALTIME_PORT ?? "3101", 10);
const host = process.env.REALTIME_HOST ?? "0.0.0.0";
const allowedOrigin = process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? true;

const httpServer = createServer((request, response) => {
  if (request.url !== "/health") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false }));
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, service: "kawuxing-realtime", protocol: SYNC_PROTOCOL,
    rooms: rooms.roomCount, connections: io.engine.clientsCount, sync: rooms.metrics }));
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: { origin: allowedOrigin, credentials: false },
  connectionStateRecovery: { maxDisconnectionDuration: 60_000, skipMiddlewares: false },
});
const rooms = new RoomManager(io);

io.on("connection", (socket) => {
  socket.data.syncProtocol = socket.handshake.auth.syncProtocol === SYNC_PROTOCOL ? SYNC_PROTOCOL : 1;
  // Validate network payloads before typed handlers reach the game engine.
  socket.use(([event, ...args], next) => {
    const ack = args.at(-1);
    if (typeof ack !== "function") return;
    if (!validateEvent(event, args.slice(0, -1))) {
      ack({ ok: false, error: "Invalid request" });
      return;
    }
    next();
  });
  socket.on("room:create", (request, ack) => ack(rooms.create(socket, request)));
  socket.on("room:join", (request, ack) => ack(rooms.join(socket, request)));
  socket.on("room:choose-wind", (wind, ack) => {
    const room = rooms.fromSocket(socket);
    ack(room ? room.chooseWind(socket.data.identity!.clientId, wind) : { ok: false, error: "请先加入房间" });
  });
  socket.on("room:update-settings", (settings, ack) => {
    const room = rooms.fromSocket(socket);
    ack(room ? room.updateSettings(socket.data.identity!.clientId, settings) : { ok: false, error: "请先加入房间" });
  });
  socket.on("room:start", (ack) => {
    const room = rooms.fromSocket(socket);
    ack(room ? room.start(socket.data.identity!.clientId) : { ok: false, error: "请先加入房间" });
  });
  socket.on("room:ready", (round, ack) => {
    const room = rooms.fromSocket(socket);
    ack(room ? room.ready(socket.data.identity!.clientId, round) : { ok: false, error: "请先加入房间" });
  });
  socket.on("room:chat", (text, ack) => {
    const room = rooms.fromSocket(socket);
    ack(room ? room.chat(socket.data.identity!.clientId, text) : { ok: false, error: "请先加入房间" });
  });
  socket.on("room:leave", (ack) => {
    ack(rooms.leave(socket));
  });
  socket.on("game:action", (action, ack) => {
    const room = rooms.fromSocket(socket);
    if (socket.data.syncProtocol === SYNC_PROTOCOL && !action.actionId) {
      ack({ ok: false, error: "操作缺少编号，请刷新页面后重试" });
      return;
    }
    ack(room ? room.action(socket.data.identity!.clientId, action) : { ok: false, error: "请先加入房间" });
  });
  socket.on("game:resync", (ack) => {
    const room = rooms.fromSocket(socket);
    if (!room) return ack({ ok: false, error: "请先加入房间" });
    room.resync(socket.data.identity!.clientId);
    ack({ ok: true, data: undefined });
  });
  socket.on("realtime:ping", (ack) => ack({ ok: true, data: rooms.fromSocket(socket)?.cursor ?? null }));
  socket.on("disconnect", () => rooms.disconnect(socket));
});

httpServer.listen(port, host, () => {
  console.log(`Kawuxing realtime server listening on ${port}`);
});
