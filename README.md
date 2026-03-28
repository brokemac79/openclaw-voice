# openclaw-voice (Phase 1 MVP)

Browser push-to-talk client + Node endpoint for this pipeline:

1. Browser audio upload
2. OpenAI Whisper transcription
3. OpenClaw query
4. Edge TTS audio synthesis
5. Browser audio playback

## What this MVP includes

- PWA-style browser UI with one-screen setup and push-to-talk interaction
- Bearer-token authentication on `/api/voice/turn`
- Whisper API transcription integration
- OpenClaw HTTP endpoint integration
- Edge TTS speech synthesis and playback

## End-user documentation

- See `docs/user-guide.md` for the plain-language setup and usage guide.

## Operator vs end-user docs

- Operators/admins: use this `README.md` for install, env vars, deploy, and service operations.
- End users: use `docs/user-guide.md` for browser setup and push-to-talk usage only.

## Quick start

Node.js requirement: `>=20` (see `package.json` engines).

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment:

   ```bash
   cp .env.example .env
   ```

    Fill in at least:

    - `OPENAI_API_KEY`
    - `VOICE_API_BEARER_TOKEN`
    - `OPENCLAW_URL`

    Optional but common for production OpenClaw services:

    - `OPENCLAW_AUTH_BEARER` (sent as `Authorization: Bearer <token>` to your upstream OpenClaw endpoint)

3. Run locally:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:8787`, fill in Settings (service URL + access token), click **Save Settings**, then hold the button to talk.

## Environment reference

- `VOICE_API_BEARER_TOKEN`: required; browser clients must send this token to `/api/voice/turn`.
- `OPENCLAW_URL`: required; full HTTP(S) URL for the upstream OpenClaw-compatible chat endpoint (for example `/api/chat`), not a WebSocket URL.
- `OPENCLAW_AUTH_BEARER`: optional; bearer token forwarded to OpenClaw when your upstream requires auth.
- `OPENCLAW_METHOD`: optional; defaults to `POST`.
- `OPENCLAW_INPUT_FIELD`: optional; defaults to `input`.
- `OPENCLAW_OUTPUT_FIELD`: optional; defaults to `response`.

Example `.env` snippet:

```bash
OPENCLAW_URL="https://openclaw.example.com/api/chat"
OPENCLAW_AUTH_BEARER="replace-with-upstream-openclaw-token"
VOICE_API_BEARER_TOKEN="replace-with-browser-client-token"
```

`OPENCLAW_URL` should point at the upstream HTTP endpoint this server can `POST` JSON to. Do not use an OpenClaw WebSocket URL such as `ws://` or `wss://` here.

## UX notes (Phase 1 usability pass)

- Settings are persisted in browser local storage so users do not need to edit `.env` files.
- Basic fields are kept simple (`Voice Service URL`, `Access Token`, `Room Name`), with `API Path` under **Advanced settings**.
- The talk button uses pointer events for mouse/touch and is intentionally large for mobile/iOS use.

## API contract

### `POST /api/voice/turn`

- Auth: `Authorization: Bearer <VOICE_API_BEARER_TOKEN>`
- Content type: `multipart/form-data`
- Fields:
  - `audio` (required): recorded audio blob
  - `sessionId` (optional): conversation/session id

Response payload:

```json
{
  "transcription": "...",
  "responseText": "...",
  "audioMimeType": "audio/mpeg",
  "audioBase64": "..."
}
```

## Deploy notes (VPS)

- Run behind HTTPS reverse proxy (nginx or Caddy)
- Keep `VOICE_API_BEARER_TOKEN` and optional `OPENCLAW_AUTH_BEARER` secret and rotated
- Restrict allowed browser origins at the reverse proxy if only one UI origin should call it
- Use a process manager (systemd or pm2) for restart-on-crash and boot persistence

### nginx reverse proxy example

```nginx
server {
  listen 443 ssl;
  server_name voice.example.com;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### Caddy reverse proxy example

```caddy
voice.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

### systemd service example

```ini
[Unit]
Description=openclaw-voice
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/openclaw-voice
EnvironmentFile=/opt/openclaw-voice/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

### pm2 example

```bash
pm2 start npm --name openclaw-voice -- start
pm2 save
pm2 startup
```

## Known MVP limits

- Push-to-talk only (no background or wake word in this phase)
- Edge TTS is used per Phase 1 plan; future phases should include fallback provider hardening
