# Deployment Guide — Operator/Admin Only

> [!WARNING]
> **This guide is for operators and administrators, not regular users.**
>
> If you only want to use OpenClaw Voice in your browser, stop here and read [the user guide](user-guide.md) instead.
> If you want to set up OpenClaw Voice on your own machine for the first time, start with [host-it-yourself.md](host-it-yourself.md) instead.
>
> This guide assumes you have already completed local setup and `http://localhost:8787` works on your host machine.

Use this guide when you want OpenClaw Voice to:

- keep running in the background even after you close your terminal, **and**
- be reachable from another device (phone, tablet, second laptop)

---

## Am I the right person for this guide?

Use this guide only if **all** of the following are true:

- You finished `docs/host-it-yourself.md` and confirmed `http://localhost:8787` works locally.
- You are comfortable running terminal commands without step-by-step coaching.
- You are willing to troubleshoot failures on your own or with help from a developer.
- You have about 20–40 minutes to test from the host machine and a second device.

If any of those are a stretch, ask the person who manages your OpenClaw setup to do this part, and use `docs/user-guide.md` to access the already-hosted service.

---

## What this guide does

This guide sets up two things:

1. **A background process manager (`pm2`)** — keeps OpenClaw Voice running even when you close your terminal or log out.
2. **A temporary public tunnel (`cloudflared`)** — creates a secure HTTPS URL so other devices can reach the server running on your machine.

### Tools explained

**`pm2`** is a process manager for Node.js apps. Think of it like a system service that restarts your app automatically if it crashes, and keeps it running in the background without needing a terminal window open. You install it once and tell it to watch your app.

**`cloudflared`** is Cloudflare's tunnel tool. It creates a temporary public HTTPS URL that routes traffic to your locally-running server. This lets a phone or another laptop on a different network reach `localhost:8787` on your machine — without opening router ports or setting up a domain. The URL changes each time you restart the tunnel (see appendix for permanent alternatives).

**Why two terminal windows?** The tunnel command (`cloudflared tunnel ...`) must stay running to keep the public URL active. You need it open in one terminal while you do other things (verify health, test, etc.) in another terminal. If you close the tunnel terminal, the public URL stops working.

---

## What a successful deployment looks like

You are done when all of these are true:

- `pm2 status` shows `openclaw-voice` as `online`
- `curl http://localhost:8787/health` returns `{"ok":true}` on the host
- `cloudflared tunnel --url http://127.0.0.1:8787` prints an HTTPS URL in the terminal
- the HTTPS URL loads the OpenClaw Voice page on a second device
- the second device can complete a voice request

---

## Choose your platform walkthrough

- [Linux](#linux-walkthrough)
- [macOS](#macos-walkthrough)
- [Windows](#windows-walkthrough)

---

## Linux walkthrough

These commands assume Debian or Ubuntu. For other distros, substitute your package manager commands.

### 1) Install prerequisites

```bash
sudo apt update
sudo apt install -y git curl
```

Install Node.js 20+ and verify:

```bash
node --version
npm --version
```

### 2) Get the project and install dependencies

```bash
git clone https://github.com/brokemac79/openclaw-voice.git
cd openclaw-voice
npm install
cp .env.example .env
```

Fill `.env` with your real OpenClaw URL and token values. See `docs/env-reference.md` for what each value means.

### 3) Confirm local run before background mode

Start the server in the foreground first to verify your `.env` is correct:

```bash
npm start
```

Open a second terminal and test the health endpoint:

```bash
curl http://localhost:8787/health
```

Expected result: `{"ok":true}`. If you see an error, fix `.env` before continuing. Once it works, stop the server with `Ctrl+C`.

### 4) Install and start `pm2`

`pm2` keeps the server running in the background after you close this terminal.

```bash
sudo npm install -g pm2
pm2 start npm --name openclaw-voice -- start
pm2 save
pm2 startup
```

`pm2 startup` prints an extra command (starting with `sudo env`). **Run that printed command** to register pm2 as a system service so it survives reboots. Then:

```bash
pm2 save
pm2 status
```

`pm2 status` should show `openclaw-voice` with status `online`. If it shows `errored`, run `pm2 logs openclaw-voice` to see what went wrong.

### 5) Start Cloudflare tunnel

Install `cloudflared` and start the tunnel. Keep this terminal open — the public URL stays active only while this command runs.

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
cloudflared tunnel --url http://127.0.0.1:8787
```

The command prints a line like:
```
https://some-random-name.trycloudflare.com
```

That is your public HTTPS URL. Copy it for the next step. **Do not close this terminal.**

### 6) Test from a second device

On a phone, tablet, or second laptop:

1. Open the `https://...trycloudflare.com` URL
2. Allow microphone access when prompted
3. Paste your `VOICE_API_BEARER_TOKEN` into the Access Token field
4. Run a short voice request

If this works, Linux deployment is complete.

---

## macOS walkthrough

### 1) Install prerequisites

Install Node.js 20 LTS from <https://nodejs.org/en/download>, then verify:

```bash
node --version
npm --version
```

Install Homebrew if not present (<https://brew.sh>), then install Git and cloudflared:

```bash
brew install git cloudflared
```

### 2) Get the project and install dependencies

```bash
git clone https://github.com/brokemac79/openclaw-voice.git
cd openclaw-voice
npm install
cp .env.example .env
```

Fill `.env` with your real values. See `docs/env-reference.md`.

### 3) Confirm local run before background mode

```bash
npm start
```

Open a second Terminal window:

```bash
curl http://localhost:8787/health
```

Expected result: `{"ok":true}`. Stop the server with `Ctrl+C` once confirmed.

### 4) Install and start `pm2`

`pm2` keeps the server running in the background.

```bash
npm install -g pm2
pm2 start npm --name openclaw-voice -- start
pm2 save
pm2 startup
```

Run the extra command printed by `pm2 startup`, then:

```bash
pm2 save
pm2 status
```

Check that `openclaw-voice` shows `online`.

### 5) Start Cloudflare tunnel

Keep this terminal open — the public URL stays active only while this runs.

```bash
cloudflared --version
cloudflared tunnel --url http://127.0.0.1:8787
```

Copy the `https://...trycloudflare.com` URL printed to the terminal. **Do not close this terminal.**

### 6) Test from a second device

1. Open the `https://...trycloudflare.com` URL
2. Allow microphone access
3. Paste your `VOICE_API_BEARER_TOKEN`
4. Run a short voice request

If this works, macOS deployment is complete.

---

## Windows walkthrough

Use PowerShell for commands below.

### 1) Install prerequisites

Install Node.js 20 LTS from <https://nodejs.org/en/download>.

Install Git for Windows from <https://git-scm.com/download/win> if you want to clone with Git. (Alternatively, download a ZIP from GitHub.)

Install Cloudflare tunnel:

```powershell
winget install --id Cloudflare.cloudflared -e
```

Verify Node and npm:

```powershell
node --version
npm --version
```

### 2) Get the project and install dependencies

```powershell
git clone https://github.com/brokemac79/openclaw-voice.git
cd openclaw-voice
npm install
Copy-Item .env.example .env
```

If you downloaded a ZIP instead of cloning, extract it and run `npm install` in that folder.

Fill `.env` with your real values. See `docs/env-reference.md`.

### 3) Confirm local run before background mode

```powershell
npm start
```

Open a second PowerShell window:

```powershell
curl http://localhost:8787/health
```

Expected result: `{"ok":true}`. Stop the server with `Ctrl+C` once confirmed.

### 4) Install and start `pm2`

`pm2` keeps the server running in the background.

```powershell
npm install -g pm2
pm2 start npm --name openclaw-voice -- start
pm2 save
pm2 startup
```

`pm2 startup` prints a follow-up command. Run that command in an **elevated (Administrator) PowerShell window**, then return to the regular window and run:

```powershell
pm2 save
pm2 status
```

Check that `openclaw-voice` shows `online`.

### 5) Start Cloudflare tunnel

Keep this terminal open — the public URL stays active only while this runs.

```powershell
cloudflared --version
cloudflared tunnel --url http://127.0.0.1:8787
```

Copy the `https://...trycloudflare.com` URL. **Do not close this window.**

### 6) Test from a second device

1. Open the `https://...trycloudflare.com` URL
2. Allow microphone
3. Paste your `VOICE_API_BEARER_TOKEN`
4. Run a short voice request

If this works, Windows deployment is complete.

---

## Troubleshooting

### `pm2` process shows `errored` or is not online

Check the logs:

```bash
pm2 logs openclaw-voice
```

Common causes: bad values in `.env`, Node.js version mismatch, or port already in use. Fix `.env`, then restart:

```bash
pm2 restart openclaw-voice
```

### Tunnel command does not show a URL

- Verify `cloudflared --version` works
- Verify the server is running: `curl http://localhost:8787/health` should return `{"ok":true}`
- Retry: `cloudflared tunnel --url http://127.0.0.1:8787`

### Second device opens page but microphone is blocked

The browser requires HTTPS for microphone access. Make sure you used the `https://...trycloudflare.com` URL, not a local `http://` address. Recheck browser site microphone permission and try again in Chrome, Edge, Safari, or Firefox.

### Tunnel URL worked earlier and now returns an error

Quick Tunnel URLs are temporary — they expire or reset when the tunnel process restarts or the machine reboots. Run the tunnel command again to get a new URL:

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

See the appendix below if you need a permanent URL.

---

## Appendix — Operator-only: permanent and advanced alternatives

> [!NOTE]
> The options below are for experienced operators who need production-grade setups. They require additional accounts, configuration, and comfort with networking. If you are not sure you need these, the Quick Tunnel path above is sufficient for most home and small-team use.

- **Permanent URL**: move to a named Cloudflare Tunnel on your own domain (requires a Cloudflare account and DNS management)
- **Private network only**: use Tailscale to share the service across devices without a public URL
- **Linux service without pm2**: use `systemd` to manage the process instead of pm2
- **Custom reverse proxy**: use Caddy or Nginx on your own domain for full control over TLS and routing
