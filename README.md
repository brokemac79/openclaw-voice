# openclaw-voice (Phase 4)

Voice interface for OpenClaw with:

1. browser push-to-talk client
2. local faster-whisper speech-to-text
3. OpenClaw upstream query
4. Edge TTS or local Piper TTS generation
5. optional Sonos relay output
6. optional desktop persistent voice client with wake word
7. proactive alert API for Sonos announcements

## Phase 4 highlights

- Local STT via `faster-whisper` (no OpenAI Whisper dependency)
- Sonos output integration through a local HTTP relay endpoint
- Desktop client (`npm run desktop:client`) for non-browser usage
- Wake word activation (`Hey OpenClaw`) via Picovoice Porcupine
- Global hotkey fallback trigger when wake word is unavailable
- Wake confirmation beep on trigger
- Proactive Sonos alert endpoint (`POST /api/voice/alerts`) for doorbell/calendar/energy events
- Ambient desktop loop mode for always-on background capture
- Switchable TTS providers (`TTS_PROVIDER=edge|piper|auto`) with Piper fallback support
- Dual-relay support for Sonos migration (`SONOS_RELAY_URL` / `SONOS_RELAY_PI_URL` + `SONOS_RELAY_FALLBACK_URL`)

## End-user documentation

- See `docs/user-guide.md` for user-focused setup and operation.

## Quick start (server)

Node requirement: `>=20`.

1. Install Node dependencies:

   ```bash
   npm install
   ```

2. Create environment file:

   ```bash
   cp .env.example .env
   ```

3. Install Python dependencies for local faster-whisper:

   ```bash
   python3 -m pip install faster-whisper
   ```

4. Fill required `.env` values:

   - `VOICE_API_BEARER_TOKEN`
   - `OPENCLAW_URL`

5. Start server:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:8787` and use the web client.

## Desktop client (persistent process)

Run the CLI-based desktop client:

```bash
npm run desktop:client
```

Default behavior:

- detect wake phrase using Porcupine (if configured)
- support global hotkey fallback (`Ctrl+Shift+Space` by default)
- keep Enter-to-record as a manual fallback
- send to `/api/voice/turn`
- print transcription + response
- save reply audio to temp directory
- optional local playback when `VOICE_CLIENT_PLAY_COMMAND` is configured

The client is designed to run continuously (for example under `systemd`, `pm2`, or a startup script).

### Wake word setup

To enable the default `Hey OpenClaw` wake flow on the desktop client:

1. Install dependencies with `npm install` so the Porcupine and global hotkey packages are available.
2. Copy `.env.example` to `.env` if you have not already done so.
3. Set `PORCUPINE_ACCESS_KEY` to your Picovoice access key.
4. Set `VOICE_CLIENT_PORCUPINE_KEYWORD_PATH` to the absolute path of your `.ppn` keyword file.
5. Optional: set `VOICE_CLIENT_PORCUPINE_MODEL_PATH` if you are using a non-default Porcupine model file.
6. Leave `VOICE_CLIENT_WAKE_MODE=auto` to prefer wake word and fall back to hotkey/manual entry, or set it to `wake-word`, `hotkey`, `manual`, or `ambient` for stricter behavior.

Recommended operator notes:

- Keep `VOICE_CLIENT_WAKE_BEEP_ENABLED=true` so users hear confirmation before speaking.
- Leave `VOICE_CLIENT_HOTKEY_ENABLED=true` and adjust `VOICE_CLIENT_HOTKEY_KEY` / `VOICE_CLIENT_HOTKEY_MODIFIERS` if you want a fallback trigger.
- Use `VOICE_CLIENT_WAKE_COOLDOWN_MS` to prevent repeated accidental triggers.
- On Linux, the global hotkey listener expects a desktop session that supports system-wide key capture.

### Ambient mode setup

Use ambient mode when the desktop client should wake itself on a timer instead of waiting for a wake word or hotkey.

1. Set `VOICE_CLIENT_WAKE_MODE=ambient` for strict ambient polling, or keep `VOICE_CLIENT_WAKE_MODE=auto` and set `VOICE_CLIENT_AMBIENT_MODE=true` if you want ambient capture enabled alongside the normal client behavior.
2. Set `VOICE_CLIENT_AMBIENT_INTERVAL_MS` to the delay between captures. Keep it at `1000` or higher.
3. Leave `VOICE_CLIENT_AMBIENT_AUTO_START=true` if the loop should begin immediately at process start.
4. Start the client with `npm run desktop:client` and confirm you see `Ambient loop active.` in the terminal.

Ambient mode still keeps manual Enter-triggered recording available in the terminal.

### Piper TTS setup

Use Piper when you want local speech synthesis or a fallback when Edge TTS is unavailable.

1. Install the Piper CLI and download a voice model on the machine running the server.
2. Set `TTS_PROVIDER=piper` to force Piper, or set `TTS_PROVIDER=edge` plus `TTS_FALLBACK_PROVIDER=piper` to keep Edge as the first choice.
3. Set `PIPER_MODEL_PATH` to the absolute path of the downloaded `.onnx` voice model.
4. Optional: set `PIPER_BIN` if the executable is not available as `piper` on your `PATH`.
5. Optional: tune `PIPER_SPEAKER_ID`, `PIPER_LENGTH_SCALE`, `PIPER_NOISE_SCALE`, `PIPER_NOISE_W`, and `PIPER_SENTENCE_SILENCE` for your chosen voice.

Important: if Piper is your primary provider, or your Edge provider falls back to Piper, the service needs a valid `PIPER_MODEL_PATH` before it can synthesize responses.

### Sonos Pi relay migration

Phase 4 supports a gradual relay move without changing clients.

Important: Sonos playback is optional and needs a separate relay service running on your local network. This app does not include built-in Sonos transport; it only sends generated audio to your relay endpoint.

1. Keep `SONOS_RELAY_URL` pointed at the current primary relay, or set `SONOS_RELAY_PI_URL` if you want a clearer LAN/Pi-specific alias.
2. Set `SONOS_RELAY_FALLBACK_URL` to the secondary relay that should receive traffic if the primary fails.
3. Set `SONOS_RELAY_AUTH_BEARER` if your relay requires bearer auth.
4. Adjust `SONOS_RELAY_TIMEOUT_MS` to control how long each relay attempt can take before failover.
5. Verify both endpoints with `GET /api/sonos/relay/health` before moving production traffic.

Relay implementation guidance:

- Required behavior: expose an HTTP POST endpoint that accepts the JSON payload shown in [Sonos relay payload contract](#sonos-relay-payload-contract), then forward `audioBase64` to the target Sonos room.
- Reference project: `jishi/node-sonos-http-api` is a common base for Sonos control; add a small adapter route that matches this app's payload contract.

The server treats `SONOS_RELAY_PI_URL` as an alias for the primary relay URL. If both are set, `SONOS_RELAY_URL` wins.

## Environment reference

Required:

- `VOICE_API_BEARER_TOKEN`
- `OPENCLAW_URL`

OpenClaw options:

- `OPENCLAW_AUTH_BEARER`
- `OPENCLAW_METHOD` (default `POST`)
- `OPENCLAW_INPUT_FIELD` (default `input`)
- `OPENCLAW_OUTPUT_FIELD` (default `response`)

faster-whisper options:

- `FASTER_WHISPER_PYTHON_BIN` (default `python3`)
- `FASTER_WHISPER_MODEL` (default `base.en`)
- `FASTER_WHISPER_LANGUAGE` (default `en`)
- `FASTER_WHISPER_DEVICE` (default `auto`)
- `FASTER_WHISPER_COMPUTE_TYPE` (default `int8`)
- `FASTER_WHISPER_TIMEOUT_MS` (default `120000`)

Sonos relay options:

Use these only when you run an external Sonos relay service:

- `SONOS_RELAY_URL` (primary relay endpoint)
- `SONOS_RELAY_PI_URL` (alias for primary LAN relay endpoint)
- `SONOS_RELAY_FALLBACK_URL` (optional secondary relay endpoint)
- `SONOS_RELAY_AUTH_BEARER` (optional bearer token for relay auth)
- `SONOS_RELAY_TIMEOUT_MS` (request timeout per relay attempt)
- `SONOS_ROOM_DEFAULT`

TTS provider options:

- `TTS_PROVIDER` (`edge`, `piper`, `auto`)
- `TTS_FALLBACK_PROVIDER` (`piper` supported fallback for `edge`)
- `PIPER_BIN` (default `piper`)
- `PIPER_MODEL_PATH` (required when using Piper)
- `PIPER_SPEAKER_ID`
- `PIPER_LENGTH_SCALE`
- `PIPER_NOISE_SCALE`
- `PIPER_NOISE_W`
- `PIPER_SENTENCE_SILENCE`

Desktop client options:

- `VOICE_CLIENT_SERVICE_URL`
- `VOICE_CLIENT_API_PATH`
- `VOICE_CLIENT_BEARER_TOKEN`
- `VOICE_CLIENT_SESSION_ID`
- `VOICE_CLIENT_SONOS_ROOM`
- `VOICE_CLIENT_OUTPUT_DIR` (defaults to OS temp dir `openclaw-voice-client`)
- `VOICE_CLIENT_RECORD_COMMAND`
- `VOICE_CLIENT_PLAY_COMMAND`
- `VOICE_CLIENT_WAKE_MODE` (`auto`, `wake-word`, `hotkey`, `manual`, or `ambient`)
- `VOICE_CLIENT_AMBIENT_MODE` (enables ambient loop mode)
- `VOICE_CLIENT_AMBIENT_INTERVAL_MS` (ambient loop interval)
- `VOICE_CLIENT_AMBIENT_AUTO_START` (ambient loop auto-start)
- `VOICE_CLIENT_WAKE_WORD_ENABLED`
- `VOICE_CLIENT_HOTKEY_ENABLED`
- `VOICE_CLIENT_WAKE_COOLDOWN_MS`
- `VOICE_CLIENT_WAKE_BEEP_ENABLED`
- `VOICE_CLIENT_WAKE_BEEP_COMMAND`
- `PORCUPINE_ACCESS_KEY`
- `VOICE_CLIENT_PORCUPINE_KEYWORD_PATH`
- `VOICE_CLIENT_PORCUPINE_MODEL_PATH`
- `VOICE_CLIENT_PORCUPINE_SENSITIVITY`
- `VOICE_CLIENT_PORCUPINE_DEVICE_INDEX`
- `VOICE_CLIENT_HOTKEY_KEY`
- `VOICE_CLIENT_HOTKEY_MODIFIERS`

## Sonos relay payload contract

Sonos support is optional. When enabled, this app POSTs audio to a separate relay service; it does not talk to Sonos devices directly.

When `SONOS_RELAY_URL` is set, each voice turn sends this JSON payload to the relay:

```json
{
  "room": "Kitchen",
  "text": "Assistant response text",
  "audioMimeType": "audio/mpeg",
  "audioBase64": "..."
}
```

Expected relay behavior:

- accept local LAN POST requests
- play supplied MP3 audio on the specified Sonos room
- return JSON status

## API contract

### `POST /api/voice/turn`

- Auth: `Authorization: Bearer <VOICE_API_BEARER_TOKEN>`
- Content type: `multipart/form-data`
- Fields:
  - `audio` (required)
  - `sessionId` (optional)
  - `sonosRoom` (optional; overrides `SONOS_ROOM_DEFAULT`)

Response:

```json
{
  "transcription": "...",
  "responseText": "...",
  "audioMimeType": "audio/mpeg",
  "audioBase64": "...",
  "sonos": {
    "routed": true,
    "room": "Kitchen"
  }
}
```

### `POST /api/voice/alerts`

Use this endpoint for proactive notifications (for example: doorbell, calendar reminders, energy price alerts).

- Auth: `Authorization: Bearer <VOICE_API_BEARER_TOKEN>`
- Content type: `application/json`
- Body:

```json
{
  "title": "Doorbell",
  "message": "Someone is at the front door.",
  "room": "Kitchen",
  "source": "doorbell"
}
```

Response includes routed room, synthesized text, and selected TTS provider.

Example:

```bash
curl -X POST http://localhost:8787/api/voice/alerts \
  -H "Authorization: Bearer <VOICE_API_BEARER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Doorbell",
    "message": "Someone is at the front door.",
    "room": "Kitchen",
    "source": "doorbell"
  }'
```

### `GET /api/sonos/relay/health`

- Auth: `Authorization: Bearer <VOICE_API_BEARER_TOKEN>`
- Returns reachability of configured primary/fallback relay URLs.

Example:

```bash
curl http://localhost:8787/api/sonos/relay/health \
  -H "Authorization: Bearer <VOICE_API_BEARER_TOKEN>"
```

## Deploy notes

- Run behind HTTPS reverse proxy for browser clients
- Keep bearer tokens secret and rotated
- Run Sonos relay on a LAN host with reliable uptime
- Use process supervision (`systemd` or `pm2`) for both server and desktop client
