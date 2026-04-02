# Sonos VPS Relay Service

The VPS-side Sonos relay (`src/sonos-relay-server.js`) is the companion service that
receives audio from `openclaw-voice` and plays it on a Sonos speaker via the Sonos
UPnP/AVTransport API.

## How it works

1. The voice server synthesises a TTS audio clip and POSTs it (base64-encoded) to this relay.
2. The relay writes the clip to a temporary file and serves it over a short-lived HTTP URL.
3. The relay calls the Sonos UPnP `SetAVTransportURI` + `Play` actions, pointing the speaker
   at that URL.
4. After `SONOS_RELAY_CLIP_TTL_MS` milliseconds the file is deleted automatically.

## Prerequisites

- Node.js ≥ 20 on the VPS
- The VPS must be able to reach the Sonos speaker's IP directly (e.g. via Tailscale subnet routing)
- The Sonos speaker must be able to reach the VPS on `SONOS_RELAY_PORT` to download the audio clip

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

## Required environment variables

| Variable | Description |
|---|---|
| `SONOS_RELAY_BEARER_TOKEN` | Secret token the voice server uses when calling this relay |
| `SONOS_IP` | IP address of the Sonos speaker (e.g. `192.168.4.33`) |
| `SONOS_RELAY_VPS_URL` | Base URL of this relay reachable by the Sonos speaker (e.g. `http://10.8.0.1:8788`) |

## Optional environment variables

| Variable | Default | Description |
|---|---|---|
| `SONOS_RELAY_PORT` | `8788` | Port this relay server listens on |
| `SONOS_PORT` | `1400` | Sonos UPnP port |
| `SONOS_RELAY_CLIP_TTL_MS` | `30000` | Milliseconds to keep the audio clip file before deleting it |

## Starting the relay

```bash
node src/sonos-relay-server.js
```

Or with the npm script:

```bash
npm run sonos:relay
```

### Windows host reliability

If your relay host is Windows, run the relay as a managed service wrapper (for example NSSM) instead of only relying on a user logon task.

Recommended behavior:

- start automatically at boot
- restart on failure
- run with the same `.env` values each time

This avoids the common "works after login but later goes offline" relay pattern.

## systemd setup

Copy the unit file and enable it:

```bash
sudo cp deploy/systemd/openclaw-voice-sonos-relay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-voice-sonos-relay
sudo systemctl status openclaw-voice-sonos-relay
```

The unit file assumes the app lives at `/opt/openclaw-voice` and runs as the `openclaw` user.
Adjust `WorkingDirectory`, `User`, and `EnvironmentFile` if your setup differs.

## Pointing the voice server at this relay

In the voice server's `.env`, set:

```env
SONOS_RELAY_URL=http://<vps-ip-or-hostname>:8788/play-audio
SONOS_RELAY_AUTH_BEARER=<same-value-as-SONOS_RELAY_BEARER_TOKEN>
SONOS_ROOM_DEFAULT=<your Sonos room name, e.g. Kitchen>
```

The `SONOS_RELAY_URL` must point to the `/play-audio` endpoint of this relay, at the
address/port that the voice server can reach it on (which may differ from
`SONOS_RELAY_VPS_URL` if you use a reverse proxy or Tailscale).

## Health check

```bash
curl http://localhost:8788/health
# {"ok":true,"sonosIp":"192.168.4.33","sonosPort":1400,"vpsBaseUrl":"http://10.8.0.1:8788"}
```

## Troubleshooting

| Symptom | Check |
|---|---|
| `missing required env vars` on startup | Verify all three required vars are in `.env` |
| `Sonos SOAP SetAVTransportURI failed (500)` | Confirm `SONOS_IP` and VPS → Sonos network path |
| Sonos does not play | Verify the Sonos speaker can reach `SONOS_RELAY_VPS_URL` — check `SONOS_RELAY_VPS_URL` is set to the correct VPS address from the Sonos device's perspective |
| `Clip not found or expired` errors in logs | Increase `SONOS_RELAY_CLIP_TTL_MS` if Sonos is slow to fetch the clip |
