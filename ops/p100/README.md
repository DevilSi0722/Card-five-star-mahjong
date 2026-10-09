# P100 deployment

Source checkout: `/data2/siran/work/KWXmahjong`, branch
`feature/server-realtime-multiplayer`. Production builds, processes, logs and release
metadata live in the ignored `.p100/` directory. Edit the source checkout, commit and
push to GitHub, then deploy the commit. Never edit `.p100/current` directly.

```bash
# Initial setup (no root or Docker required)
chmod +x ops/p100/kwxctl
ops/p100/kwxctl install
ops/p100/kwxctl deploy

# Routine releases from a developer machine
git push origin feature/server-realtime-multiplayer
ssh P100 '/data2/siran/work/KWXmahjong/.p100/bin/kwxctl deploy'
ssh P100 '/data2/siran/work/KWXmahjong/.p100/bin/kwxctl version'
ssh P100 '/data2/siran/work/KWXmahjong/.p100/bin/kwxctl status'
ssh P100 '/data2/siran/work/KWXmahjong/.p100/bin/kwxctl rollback'
```

`deploy <commit-or-tag>` pins a specific revision. Deployment fetches GitHub,
builds in an independent release directory with two Next.js build workers, and
runs multiplayer acceptance checks before activation. It changes the current
release symlink, restarts only this application's web/realtime processes, and
checks both HTTP health and a complete multiplayer round through the gateway.
Failed activation restores the previous release. Build failures leave the current
release running. Operations and the watchdog share a lock.

The independent Supervisor restarts failed processes and rotates logs. User cron
starts it at reboot and checks it each minute. `stop` disables the watchdog until
`start` or a deployment. Existing projects and their supervisors are independent.
Logs: `.p100/logs/kwx-{web,realtime,gateway}.log`.

## Cloudflare

In the existing P100 tunnel (ID `5175ac53-28fc-4974-bca5-d626bd4b6e84`, the one
serving `api.dscode.win`), add a published application route:

- Subdomain: `kwx`
- Domain: `dscode.win`
- Path: blank
- Service type: `HTTP`
- Service URL: `127.0.0.1:18140`

Save the route. Cloudflare creates the DNS record. No additional tunnel token,
Tailscale configuration, exposed server port, or separate WebSocket hostname is
needed. Cloudflare SSL/TLS Network WebSockets must be enabled (normally default).
Avoid caching `/socket.io/*`; do not apply a Cache Everything rule to this hostname.
WebSocket and HTTP polling both use `https://kwx.dscode.win/socket.io/`.

Check `https://kwx.dscode.win/_health/realtime` after adding the route; it must return
`{"ok":true,"service":"kawuxing-realtime"}`. To repeat protocol acceptance:

```bash
cd /data2/siran/work/KWXmahjong/.p100/current
npm run check:realtime -- https://kwx.dscode.win
```

The gateway binds `127.0.0.1:18140`; Next.js and Socket.IO bind loopback ports
18141 and 18142. Caddy's local administration port is 18143. Browser CORS allows
the public hostname and loopback test origin. Production assets do not embed a
Tailscale URL or a fixed realtime endpoint.

## Development and operational limits

Run `npm ci`, `npm run dev`, and `npm run dev:realtime` in separate terminals.
Set `NEXT_PUBLIC_REALTIME_URL=http://127.0.0.1:3101` in the ignored `.env.local`
for local multiplayer development. `npm run check:realtime -- --self-test` checks
three clients, WebSocket upgrade, polling, room authority, hidden hands, chat,
reconnection, a complete round, readiness, and AI filling a two-player room.

Rooms and games are in memory, as in the original server branch. Restarting or
publishing the realtime service clears active games. Release when no one is
playing. Short network interruptions preserve the seat for reconnecting players.
Source changes on another machine can be pulled with `git pull --ff-only` when
the local checkout is clean; deployment fetches without changing that checkout.
Old releases are retained for rollback and can be reviewed before removing them.
There is no unattended automatic production release.
