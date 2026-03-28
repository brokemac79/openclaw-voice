# openclaw-voice (Phase 1 MVP)

Browser push-to-talk client + Node endpoint for this pipeline:

1. Browser audio upload
2. OpenAI Whisper transcription
3. OpenClaw query
4. Edge TTS audio synthesis
5. Browser audio playback

## What this MVP includes

- PWA-style browser UI with push-to-talk interaction
- Bearer-token authentication on `/api/voice/turn`
- Whisper API transcription integration
- OpenClaw HTTP endpoint integration
- Edge TTS speech synthesis and playback

## Quick start

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

3. Run locally:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:8787`, paste the bearer token, and hold the button to talk.

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

- Run behind HTTPS (nginx/Caddy reverse proxy)
- Keep `VOICE_API_BEARER_TOKEN` secret and rotate regularly
- Restrict CORS/origin at the reverse proxy if only one UI origin should call it
- Add process manager (systemd/pm2) for auto-restart

## Known MVP limits

- Push-to-talk only (no background or wake word in this phase)
- Edge TTS is used per Phase 1 plan; future phases should include fallback provider hardening
