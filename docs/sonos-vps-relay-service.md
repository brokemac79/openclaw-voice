# Sonos VPS Relay Service

Use this guide when you want the Sonos relay to run from this repository instead of maintaining a separate custom relay service.

What this relay does:

1. Accepts the existing OpenClaw Voice Sonos payload (`room`, `audioBase64`, `audioMimeType`, `text`).
2. Writes temporary audio files and serves them over HTTP.
3. Triggers playback through `node-sonos-http-api` using the Sonos `clip` route.

## Prerequisites

- A running `node-sonos-http-api` instance reachable by the relay host.
- Sonos speakers that can reach the relay host URL.
- OpenClaw Voice server configured to call this relay path.

### Windows users: network profile and firewall

On Windows, two settings block inbound connections by default. Both are required for Sonos to reach the relay.

**1. Network profile must be Private**

When you first connect to a WiFi network, Windows often sets it to Public. Public networks block most inbound connections, even when a firewall rule exists. Sonos will show "connection refused" until you change this.

Check and change the profile:

```powershell
# Check current profile name and category
Get-NetConnectionProfile

# Change to Private (replace 'YourNetworkName' with the Name shown above)
Set-NetConnectionProfile -Name 'YourNetworkName' -NetworkCategory Private
```

Or via the GUI: Settings → Network & Internet → WiFi → click your network name → set to **Private network**.

**Why Windows defaults to Public:** When you first connect, Windows asks whether to allow device discovery. Clicking No (or dismissing the prompt) locks the profile to Public — the safe choice for unknown networks, but it breaks LAN services like this relay.

**2. Windows Firewall inbound rule for port 8788**

```
netsh advfirewall firewall add rule name="OpenClaw Sonos Relay" dir=in action=allow protocol=TCP localport=8788
```

Both the Private network profile **and** the firewall rule are required. Either alone is not enough.

## 1) Configure `.env`

In `/opt/openclaw-voice/.env`, set:

```env
SONOS_VPS_RELAY_PORT=8788
SONOS_VPS_RELAY_PATH=/play
SONOS_VPS_RELAY_AUTH_BEARER=replace-with-relay-token
SONOS_HTTP_API_URL=http://127.0.0.1:5005
SONOS_HTTP_API_AUTH_BEARER=
SONOS_RELAY_PUBLIC_BASE_URL=http://192.168.1.50:8788
SONOS_RELAY_MEDIA_TTL_MS=900000
SONOS_RELAY_MAX_AUDIO_BYTES=15728640
```

Then point OpenClaw Voice at this relay:

```env
SONOS_RELAY_URL=http://127.0.0.1:8788/play
SONOS_RELAY_AUTH_BEARER=replace-with-relay-token
```

`SONOS_RELAY_PUBLIC_BASE_URL` must resolve from your Sonos network, not just from localhost. Use your LAN IP address (for example `192.168.x.x`) — not a Tailscale IP, VPN address, or `localhost`. Sonos speakers connect over your local WiFi network, not through VPN tunnels.

## 2) Smoke test relay manually

From the repo root:

```bash
npm run sonos:relay
```

In another terminal:

```bash
curl http://127.0.0.1:8788/health
```

Expected: `{"ok":true,...}` with your configured `sonosHttpApiUrl`.

## 3) Run relay as a service

Install the provided unit file:

```bash
sudo cp deploy/systemd/openclaw-voice-sonos-relay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-voice-sonos-relay
sudo systemctl status openclaw-voice-sonos-relay --no-pager
```

Tail logs:

```bash
sudo journalctl -u openclaw-voice-sonos-relay -f
```

## 4) Verify end-to-end from OpenClaw Voice

Call the existing health check on OpenClaw Voice:

```bash
curl -H "Authorization: Bearer <VOICE_API_BEARER_TOKEN>" \
  http://127.0.0.1:8787/api/sonos/relay/health
```

Expected: relay URL at `http://127.0.0.1:8788/play` is reachable.

Then run one voice turn or proactive alert and confirm playback in the target Sonos room.
