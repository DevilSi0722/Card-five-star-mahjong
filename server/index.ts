import { createServer } from "node:http";
import { Server } from "socket.io";
import { RoomManager } from "./roomManager";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/types/realtime";

const port = Number.parseInt(process.env.REALTIME_PORT ?? "3101", 10);
const allowedOrigin = process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? true;

const httpServer = createServer((request, response) => {
  if (request.url !== "/health") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false }));
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, service: "kawuxing-realtime" }));
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: { origin: allowedOrigin, credentials: false },
});
const rooms = new RoomManager(io);

io.on("connection", (socket) => {
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
    ack(room ? room.action(socket.data.identity!.clientId, action) : { ok: false, error: "请先加入房间" });
  });
  socket.on("disconnect", () => rooms.disconnect(socket));
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Kawuxing realtime server listening on ${port}`);
});
