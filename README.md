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

## Prerequisites (single checklist)

Use this as the one place to confirm what must be installed before setup.

Core requirements:

- Node.js 20+
- npm (comes with Node.js)
- `.env` created from `.env.example`
- `VOICE_API_BEARER_TOKEN` and `OPENCLAW_URL` configured

Speech pipeline requirements:

- Python 3 + pip
- `faster-whisper` Python package
- `ffmpeg` (audio decode dependency used by faster-whisper)

Desktop client recording requirement:

- `sox` installed on the machine running `npm run desktop:client`

Optional features (install only if you use them):

- Piper CLI + downloaded `.onnx` voice model (`PIPER_MODEL_PATH`)
- Picovoice account + `PORCUPINE_ACCESS_KEY` + keyword `.ppn` file
- Local Sonos relay service reachable by `SONOS_RELAY_URL` or `SONOS_RELAY_PI_URL`

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

3. Complete the local faster-whisper Python setup:

   ```bash
   # See the "faster-whisper Python setup (beginner-friendly)" section below.
   ```

4. Fill required `.env` values:

   - `VOICE_API_BEARER_TOKEN`
   - `OPENCLAW_URL` (must be an `http://` or `https://` endpoint; do not use `ws://` or `wss://`)

5. Start server:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:8787` and use the web client.

## faster-whisper Python setup (beginner-friendly)

If you have never installed Python tooling before, follow these steps exactly on the same machine that runs the Node server.

### 1) Install Python 3 and pip

- Python download page: <https://www.python.org/downloads/>
- pip installation/upgrade docs: <https://pip.pypa.io/en/stable/installation/>

Verify both commands work:

```bash
python3 --version
python3 -m pip --version
```

If `python3 -m pip --version` fails, install pip first, then re-run the check.

### 2) Create and activate a virtual environment (recommended)

From the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
```

Why: this keeps Python packages for this project isolated from system-wide packages.

### 3) Install ffmpeg (required for many audio files)

`faster-whisper` relies on ffmpeg for decoding common input formats.

- macOS (Homebrew): `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y ffmpeg`
- Fedora/RHEL: `sudo dnf install -y ffmpeg`
- Windows (Chocolatey): `choco install ffmpeg -y`

Verify it is available:

```bash
ffmpeg -version
```

### 4) Install faster-whisper

```bash
python3 -m pip install faster-whisper
```

### 5) Expect model download on first transcription

The first transcription downloads the selected model and caches it on disk.

- `tiny.en`: roughly 75 MB
- `base.en`: roughly 140 MB (default)
- `small.en`: roughly 460 MB

The first run can take longer depending on your network speed.

### 6) Recommended CPU-only defaults

For most CPU-only machines, start with:

```env
FASTER_WHISPER_MODEL=base.en
FASTER_WHISPER_DEVICE=cpu
FASTER_WHISPER_COMPUTE_TYPE=int8
```

If your machine is very resource-constrained, try `FASTER_WHISPER_MODEL=tiny.en` for faster/cheaper transcription with lower accuracy.

### 7) Run a standalone smoke test

If you do not already have `test.wav`, create a short sample file:

```bash
ffmpeg -f lavfi -i "anullsrc=r=16000:cl=mono" -t 2 test.wav
```

Then run:

```bash
python3 scripts/faster_whisper_transcribe.py --audio-path test.wav --model base.en
```

Expected result: JSON printed to stdout (with `text`, `language`, and `duration`) and no Python traceback.

## Verify your setup (before full end-to-end)

Run this checklist in order so each layer is validated before the next one.

1) Service health endpoint:

```bash
curl http://localhost:8787/health
```

Expected: `{"ok":true}`

2) Browser microphone capture:

- Open `http://localhost:8787` in your browser.
- Allow microphone permission when prompted.
- Hold **Hold to talk**, speak a short phrase, release.
- Confirm transcription text appears in the UI.

3) OpenClaw upstream connectivity (direct curl):

Use your actual upstream endpoint and payload shape. Example:

```bash
curl -X POST "$OPENCLAW_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENCLAW_AUTH_BEARER" \
  -d '{"input":"ping"}'
```

Expected: a normal OpenClaw response payload (not timeout/auth errors).

4) Sonos relay health (if Sonos is enabled):

```bash
curl http://localhost:8787/api/sonos/relay/health \
  -H "Authorization: Bearer <VOICE_API_BEARER_TOKEN>"
```

Expected: configured relay(s) reported reachable.

5) Desktop client manual-mode verification:

- Set `VOICE_CLIENT_WAKE_MODE=manual` in your desktop client environment.
- Run `npm run desktop:client`.
- Press Enter to record a short turn.
- Confirm transcription + response print in terminal before enabling wake-word mode.

## Desktop client prerequisites

Before running `npm run desktop:client`, confirm these requirements.

Important: the desktop client is a Node.js terminal CLI process. It is not a packaged desktop app (for example Electron).

### Platform support

- macOS: supported for wake word, hotkey, and manual modes.
- Linux: supported for wake word and manual modes. Global hotkeys require a desktop session with system-wide keyboard capture permissions.
- Windows: supported for wake word, hotkey, and manual modes in a normal desktop session.
- Headless/server-only sessions: not recommended for hotkeys because there is no active desktop keyboard session to capture.

### Install `sox` for recording (required)

`VOICE_CLIENT_RECORD_COMMAND` defaults to a `sox` command, so `sox` must be installed on the machine that runs the desktop client.

- macOS (Homebrew): `brew install sox`
- Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y sox libsox-fmt-all`
- Fedora/RHEL: `sudo dnf install -y sox`
- Windows (Chocolatey): `choco install sox.portable -y`

### Local playback command examples (optional)

Set `VOICE_CLIENT_PLAY_COMMAND` only if you want the desktop machine to play generated reply audio locally after each turn.

- macOS: `VOICE_CLIENT_PLAY_COMMAND=afplay "{output}"`
- Linux: `VOICE_CLIENT_PLAY_COMMAND=mpg123 "{output}"`
- Windows: `VOICE_CLIENT_PLAY_COMMAND=powershell -NoProfile -Command "Start-Process '{output}'"`

Tip: the reply file is written as `.mp3`, so pick a playback command that supports MP3 on your machine.

### Porcupine prerequisites (wake word)

Wake word mode requires Picovoice setup in addition to npm dependencies.

1. Create a Picovoice account at <https://console.picovoice.ai/>.
2. Generate an AccessKey in the Picovoice console and set `PORCUPINE_ACCESS_KEY`.
3. Create or select your wake keyword in Picovoice and download the `.ppn` keyword file for your target platform.
4. Set `VOICE_CLIENT_PORCUPINE_KEYWORD_PATH` to the absolute path of that `.ppn` file.
5. Optional: set `VOICE_CLIENT_PORCUPINE_MODEL_PATH` when using a non-default Porcupine model.

### Linux hotkey caveat (Wayland vs X11)

Global hotkey support depends on whether your desktop environment allows global key capture:

- X11 sessions usually work with the default hotkey listener.
- Wayland sessions may block global key capture by design, depending on compositor and policy.

If hotkey setup fails on Linux, keep wake word enabled or set `VOICE_CLIENT_WAKE_MODE=manual` as a fallback.

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

1. Install Piper from the official release source: <https://github.com/rhasspy/piper/releases>.
2. Download a voice model (`.onnx`) from Piper voices (for example: <https://huggingface.co/rhasspy/piper-voices>). Typical model filenames look like `en_US-lessac-medium.onnx`.
3. Set provider + model variables:

   ```bash
   TTS_PROVIDER=piper
   PIPER_BIN=/usr/local/bin/piper
   PIPER_MODEL_PATH=/opt/piper/en_US-lessac-medium.onnx
   ```

   Notes:

   - This repo uses `PIPER_BIN` for the executable path (same idea as `PIPER_EXECUTABLE` in some Piper guides).
   - If you prefer Edge first, keep `TTS_PROVIDER=edge` and set `TTS_FALLBACK_PROVIDER=piper`.

4. Optional: tune `PIPER_SPEAKER_ID`, `PIPER_LENGTH_SCALE`, `PIPER_NOISE_SCALE`, `PIPER_NOISE_W`, and `PIPER_SENTENCE_SILENCE` for your chosen voice.
5. Run a smoke test directly against Piper:

   ```bash
   echo "Piper smoke test" | "$PIPER_BIN" --model "$PIPER_MODEL_PATH" --output_file /tmp/piper-smoke.wav
   ls -lh /tmp/piper-smoke.wav
   ```

   If `/tmp/piper-smoke.wav` exists and is non-zero size, Piper + model path are valid.

Important: Piper outputs WAV (`audio/wav`). Edge TTS outputs MP3 (`audio/mpeg`). If Piper is your primary provider, or your Edge provider falls back to Piper, the service needs a valid `PIPER_MODEL_PATH` before it can synthesize responses.

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

### OpenClaw upstream endpoint contract

`OPENCLAW_URL` must point at an HTTP API endpoint that accepts JSON requests and returns a response body the voice server can read.

- Use `http://` or `https://` only.
- Do not use `ws://` or `wss://`.

Default request body sent to your upstream endpoint:

```json
{
  "input": "hello",
  "sessionId": "Kitchen"
}
```

Default response body expected from your upstream endpoint:

```json
{
  "response": "Hi there"
}
```

Field mapping behavior:

- `OPENCLAW_INPUT_FIELD` changes the outgoing input key.
- `OPENCLAW_OUTPUT_FIELD` changes the response key read from JSON replies.

Concrete examples:

- If `OPENCLAW_INPUT_FIELD=message`, outgoing JSON becomes `{"message":"hello","sessionId":"Kitchen"}`.
- If `OPENCLAW_OUTPUT_FIELD=reply`, incoming JSON should look like `{"reply":"Hi there"}`.

Troubleshooting wrong endpoint errors:

- `404` usually means the URL path is wrong (for example pointing at `/` instead of `/api/chat`).
- `405` usually means the endpoint does not allow the configured method (default is `POST`).
- HTML responses (for example `<!doctype html>`) usually mean `OPENCLAW_URL` is pointed at a web page instead of the JSON API endpoint.

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
