import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { WebSocket, WebSocketServer } from "ws";

/** Test-only proxy: exercise the real client without adding fault switches to production. */
export async function createFaultProxy(target: string, webTarget?: string) {
  const controls = { blockWebSocket: false, dropActionAck: false, dropPatch: false, dropAllPatches: false };
  const stats = { blockedUpgrades: 0, pollingRequests: 0, droppedAcks: 0, droppedPatches: 0, resyncRequests: 0 };
  const peers = new Set<WebSocket>();
  const server = createServer((req, res) => {
    if (req.url?.includes("transport=polling")) stats.pollingRequests += 1;
    const destination = new URL(req.url!, webTarget && !req.url?.startsWith("/socket.io/") ? webTarget : target);
    const forward = destination.protocol === "https:" ? httpsRequest : httpRequest;
    const upstream = forward(destination, { method: req.method, headers: { ...req.headers, host: destination.host } }, (response) => {
      res.writeHead(response.statusCode!, response.headers);
      response.pipe(res);
    });
    upstream.on("error", () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  const sockets = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, stream, head) => {
    if (controls.blockWebSocket) { stats.blockedUpgrades += 1; stream.destroy(); return; }
    sockets.handleUpgrade(req, stream, head, (client) => {
      const destination = new URL(req.url!, target);
      destination.protocol = destination.protocol === "https:" ? "wss:" : "ws:";
      const upstream = new WebSocket(destination, { headers: { Origin: "https://kwx.dscode.win" } });
      peers.add(client);
      peers.add(upstream);
      const buffered: string[] = [];
      let missingAck: string | undefined;
      client.on("message", (data) => {
        const message = data.toString();
        const action = /^42(\d+)\["game:action",/.exec(message);
        if (action && controls.dropActionAck) { missingAck = action[1]; controls.dropActionAck = false; }
        if (/^42\d*\["game:resync"/.test(message)) stats.resyncRequests += 1;
        if (upstream.readyState === WebSocket.OPEN) upstream.send(message);
        else buffered.push(message);
      });
      upstream.on("open", () => { for (const message of buffered) upstream.send(message); buffered.length = 0; });
      upstream.on("message", (data) => {
        const message = data.toString();
        if (missingAck && message.startsWith(`43${missingAck}[`)) {
          missingAck = undefined;
          stats.droppedAcks += 1;
          return;
        }
        if ((controls.dropPatch || controls.dropAllPatches) && message.includes('["game:sync",') && message.includes('"kind":"patch"')) {
          controls.dropPatch = false;
          stats.droppedPatches += 1;
          return;
        }
        if (client.readyState === WebSocket.OPEN) client.send(message);
      });
      const close = () => { client.terminate(); upstream.terminate(); peers.delete(client); peers.delete(upstream); };
      client.on("close", close);
      client.on("error", close);
      upstream.on("close", close);
      upstream.on("error", close);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Proxy did not start");
  return {
    url: `http://127.0.0.1:${address.port}`, controls, stats,
    interrupt: () => { for (const peer of peers) peer.terminate(); },
    close: async () => {
      for (const peer of peers) peer.terminate();
      sockets.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
