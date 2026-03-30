# VPS Deployment Guide (Ubuntu/Debian + Caddy + systemd)

Use this guide when you want a stable, always-on deployment of OpenClaw Voice on a VPS with your own domain.

This guide is for operators who are comfortable with Linux administration.

> [!IMPORTANT]
> Complete `docs/host-it-yourself.md` first so you already understand required `.env` values (`OPENCLAW_URL`, tokens, speech prerequisites).

## What this guide sets up

1. OpenClaw Voice running as a `systemd` service.
2. Caddy reverse proxy with automatic HTTPS certificates.
3. Public domain access to the app.

## Prerequisites

- Ubuntu 22.04+ or Debian 12+ VPS
- sudo access on the VPS
- Domain name you control (example: `voice.example.com`)
- DNS A/AAAA record pointing your domain to the VPS
- Real upstream OpenClaw HTTP API URL and token (if required)
- Optional for Sonos playback: a reachable HTTP Sonos relay endpoint on your LAN/VPN
- Optional for Sonos playback: target Sonos room name(s) from your Sonos app

## 1) Prepare the server

```bash
sudo apt update
sudo apt install -y curl git ca-certificates gnupg ufw
```

Install Node.js 20 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

## 2) Create app user and install app

```bash
sudo useradd --system --create-home --shell /bin/bash openclaw || true
sudo mkdir -p /opt/openclaw-voice
sudo chown -R openclaw:openclaw /opt/openclaw-voice
sudo -u openclaw git clone https://github.com/brokemac79/openclaw-voice.git /opt/openclaw-voice
cd /opt/openclaw-voice
sudo -u openclaw npm install
sudo -u openclaw cp .env.example .env
```

Install Python speech dependencies for the service user:

```bash
sudo apt install -y python3 python3-venv python3-pip ffmpeg
sudo -u openclaw python3 -m venv /opt/openclaw-voice/.venv
sudo -u openclaw /opt/openclaw-voice/.venv/bin/python3 -m pip install --upgrade pip
sudo -u openclaw /opt/openclaw-voice/.venv/bin/python3 -m pip install faster-whisper
```

Edit `/opt/openclaw-voice/.env` and set at least:

- `VOICE_API_BEARER_TOKEN`
- `OPENCLAW_URL`
- `OPENCLAW_AUTH_BEARER` (if your upstream requires auth)
- `FASTER_WHISPER_PYTHON_BIN=/opt/openclaw-voice/.venv/bin/python3`

If you also want Sonos playback from this VPS deployment, add:

- `SONOS_RELAY_URL=http://<relay-host>:<port>/<path>`
- `SONOS_RELAY_AUTH_BEARER=<token>` (only if your relay requires auth)
- `SONOS_RELAY_FALLBACK_URL=http://<backup-relay>:<port>/<path>` (optional)
- `SONOS_RELAY_TIMEOUT_MS=12000` (recommended starting point)
- `SONOS_ROOM_DEFAULT=<Exact Sonos room name>` (optional but useful)

Why this matters: `systemd` does not activate your shell profile, so a plain `python3` may resolve to an interpreter that does not have `faster-whisper` installed.

### Sonos relay topology for VPS deployments (optional)

Use this only when you want spoken replies on Sonos.

```
Browser/desktop client
  -> OpenClaw Voice on VPS (`https://voice.example.com`)
     -> OpenClaw upstream API (`OPENCLAW_URL`)
     -> Sonos relay on LAN/VPN (`SONOS_RELAY_URL`)
        -> Sonos speaker room (`SONOS_ROOM_DEFAULT` or request `sonosRoom`)
```

Important network rule: the relay host must be reachable from the VPS. If your relay only listens on a private LAN address, connect the VPS to that network (VPN, tunnel, or private link) before enabling Sonos.

Minimum relay contract:

- Accept `POST` JSON payloads from OpenClaw Voice.
- Parse `audioBase64` and play it to the requested room.
- Return `2xx` on success and non-`2xx` on failure.

Quick relay reachability check from the VPS:

```bash
curl -X POST http://<relay-host>:<port>/<path> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <relay-token-if-needed>" \
  -d '{"audioBase64":"dGVzdA==","room":"Kitchen"}'
```

Expected result: a non-timeout HTTP response from the relay (status code may vary by relay implementation).

Then do a one-time local smoke test:

```bash
cd /opt/openclaw-voice
sudo -u openclaw npm start
```

In another terminal:

```bash
curl http://127.0.0.1:8787/health
```

Expected: `{"ok":true}`. Stop the foreground app with `Ctrl+C`.

Optional speech-path check before creating the service:

```bash
cd /opt/openclaw-voice
sudo -u openclaw ffmpeg -f lavfi -i "anullsrc=r=16000:cl=mono" -t 2 test.wav
sudo -u openclaw /opt/openclaw-voice/.venv/bin/python3 scripts/faster_whisper_transcribe.py --audio-path test.wav --model base.en
```

Expected: JSON output and no `ModuleNotFoundError` for `faster_whisper`.

## 3) Create systemd service

Create `/etc/systemd/system/openclaw-voice.service`:

```ini
[Unit]
Description=OpenClaw Voice Server
After=network.target

[Service]
Type=simple
User=openclaw
Group=openclaw
WorkingDirectory=/opt/openclaw-voice
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-voice
sudo systemctl status openclaw-voice --no-pager
```

Useful service commands:

```bash
sudo journalctl -u openclaw-voice -f
sudo systemctl restart openclaw-voice
```

## 4) Install and configure Caddy

Install Caddy from the official repository:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Create `/etc/caddy/Caddyfile` (replace domain):

```caddy
voice.example.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:8787
}
```

Validate and reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

## 5) Open firewall ports

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw --force enable
sudo ufw status
```

## 6) Verify end-to-end

From the VPS:

```bash
curl http://127.0.0.1:8787/health
```

If Sonos is enabled, also verify relay health through the OpenClaw Voice API:

```bash
curl -H "Authorization: Bearer <VOICE_API_BEARER_TOKEN>" \
  http://127.0.0.1:8787/api/sonos/relay/health
```

Expected: configured primary/fallback relay entries show reachable status.

From another device/browser:

1. Open `https://voice.example.com`
2. Allow microphone access
3. Paste `VOICE_API_BEARER_TOKEN`
4. Run a short voice request
5. If using Sonos, set a valid Sonos room and confirm audio plays in that room

## Troubleshooting

### Caddy returns 502 Bad Gateway

- Check app health: `curl http://127.0.0.1:8787/health`
- Check app logs: `sudo journalctl -u openclaw-voice -n 100 --no-pager`
- Restart app service: `sudo systemctl restart openclaw-voice`

### HTTPS certificate does not issue

- Confirm DNS for your domain points to this VPS
- Confirm ports 80/443 are open in cloud firewall/security group and UFW
- Check Caddy logs: `sudo journalctl -u caddy -n 100 --no-pager`

### Service fails after reboot

- Confirm enabled state: `sudo systemctl is-enabled openclaw-voice`
- Re-enable if needed: `sudo systemctl enable openclaw-voice`

### Sonos relay check fails or Sonos playback is silent

- Confirm relay env vars are present in `/opt/openclaw-voice/.env` (`SONOS_RELAY_URL`, optional auth/fallback values)
- Confirm OpenClaw Voice can reach the relay host from the VPS network (VPN/private link/firewall)
- Confirm `SONOS_ROOM_DEFAULT` or requested `sonosRoom` exactly matches a real Sonos room name
- Check API health view: `curl -H "Authorization: Bearer <VOICE_API_BEARER_TOKEN>" http://127.0.0.1:8787/api/sonos/relay/health`
- Check service logs for relay errors/timeouts: `sudo journalctl -u openclaw-voice -n 200 --no-pager`
- If primary relay fails, configure `SONOS_RELAY_FALLBACK_URL` and retest

## Maintenance checklist

- Rotate `VOICE_API_BEARER_TOKEN` periodically
- Keep OS packages updated (`sudo apt update && sudo apt upgrade`)
- Keep Node.js LTS current
- Back up `.env` and deployment config (`Caddyfile`, systemd unit)
