# Environment Reference

This page explains every `.env` variable in beginner-friendly language.

Most people only need two values to get started: `VOICE_API_BEARER_TOKEN` and `OPENCLAW_URL`. Everything else is optional or advanced. Skip any section marked "advanced / optional" if you are doing a basic browser-only setup.

## No-guess URL and token map

Use this section when you are unsure which URL/token goes in which field.

| You are setting | Source of truth | Paste into |
| --- | --- | --- |
| Voice access token for this app | Value you create in `.env` as `VOICE_API_BEARER_TOKEN` | Browser **Access Token** field and desktop `VOICE_CLIENT_BEARER_TOKEN` (or let desktop reuse `VOICE_API_BEARER_TOKEN`) |
| Upstream OpenClaw API URL | Upstream HTTP endpoint (for example `http://192.168.1.10:3000/api/chat`) | `.env` -> `OPENCLAW_URL` |
| Upstream OpenClaw API auth token (optional) | Token from your OpenClaw/gateway host | `.env` -> `OPENCLAW_AUTH_BEARER` |

If upstream only gives you a websocket URL (example: `ws://192.168.1.10:18789`):

1. Keep the same host/IP.
2. Switch protocol to `http://` or `https://`.
3. Use the upstream chat API route on that host (commonly `/api/chat`).

Example:

- given: `ws://192.168.1.10:18789`
- set: `OPENCLAW_URL=http://192.168.1.10:3000/api/chat`

Do not put `ws://` or `wss://` into `OPENCLAW_URL`.

Columns:

- What it is: plain-English purpose
- Example value: safe sample text, not a real secret
- Needed for: which setup uses it
- Where to get it: where the value usually comes from

## Core server

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `PORT` | Local port for the voice server web page and API | `8787` | All self-hosted setups | Pick an open local port |
| `VOICE_API_BEARER_TOKEN` | Password-like token browsers and clients must send to use the voice API | `mytoken123` | All self-hosted setups | Choose any string yourself, then reuse that same value anywhere the client asks for the token |
| `OPENCLAW_URL` | HTTP endpoint for your OpenClaw-compatible chat API | `http://192.168.1.10:3000/api/chat` | All self-hosted setups | Use the upstream HTTP API endpoint on the same host; if upstream only shows `ws://...`, keep that host and switch to the matching `http://...` chat API path |
| `OPENCLAW_METHOD` | HTTP method used for upstream requests | `POST` | All self-hosted setups | Usually leave the default unless your upstream says otherwise |
| `OPENCLAW_INPUT_FIELD` | JSON field name used for the sent prompt text | `input` | All self-hosted setups | Your upstream API contract |
| `OPENCLAW_OUTPUT_FIELD` | JSON field name read from the upstream reply | `response` | All self-hosted setups | Your upstream API contract |
| `OPENCLAW_AUTH_BEARER` | Optional bearer token for the upstream OpenClaw API | `upstream-token-abc123` | Only if your upstream requires auth | Your OpenClaw or gateway auth settings |

## Speech-to-text (`faster-whisper`)

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `FASTER_WHISPER_PYTHON_BIN` | Python command used to run the transcription helper | `python3` | Local speech transcription | The Python executable available on your machine |
| `FASTER_WHISPER_MODEL` | Speech model size and language | `base.en` | Local speech transcription | Choose from faster-whisper model options |
| `FASTER_WHISPER_LANGUAGE` | Language hint for transcription | `en` | Local speech transcription | Pick the spoken language you expect |
| `FASTER_WHISPER_DEVICE` | Hardware target for transcription | `auto` | Local speech transcription | Usually `auto` or `cpu` |
| `FASTER_WHISPER_COMPUTE_TYPE` | Performance and memory setting | `int8` | Local speech transcription | Usually keep the default for CPU use |
| `FASTER_WHISPER_TIMEOUT_MS` | Max wait time before a transcription is treated as failed | `120000` | Local speech transcription | Pick a timeout that matches your hardware |

## Edge TTS

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `EDGE_TTS_VOICE` | Microsoft Edge TTS voice name | `en-US-AndrewNeural` | Edge speech output | Pick from Edge TTS voice names |
| `EDGE_TTS_RATE` | Speaking speed adjustment | `+0%` | Edge speech output | Choose a faster or slower rate |
| `EDGE_TTS_VOLUME` | Volume adjustment | `+0%` | Edge speech output | Choose louder or quieter output |
| `EDGE_TTS_PITCH` | Pitch adjustment | `+0Hz` | Edge speech output | Optional voice tuning |

## TTS provider selection

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `TTS_PROVIDER` | Which text-to-speech engine to use first | `edge` | Spoken replies | Choose `edge`, `piper`, or `auto` |
| `TTS_FALLBACK_PROVIDER` | Backup TTS provider if the main one fails | `piper` | Edge with Piper fallback | Usually leave `piper` if you install Piper |

## Piper TTS (advanced / optional)

Skip this section unless you want local Piper output.

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `PIPER_BIN` | Piper executable name or full path | `piper` | Piper output | Piper install location |
| `PIPER_MODEL_PATH` | Path to the downloaded Piper `.onnx` voice model | `/opt/piper/en_US-lessac-medium.onnx` (macOS/Linux) or `C:\piper\en_US-lessac-medium.onnx` (Windows) | Piper output | Download a model from Piper voices |
| `PIPER_SPEAKER_ID` | Speaker index for multi-speaker models | `0` | Some Piper models only | Piper model docs |
| `PIPER_LENGTH_SCALE` | Slows down or speeds up Piper speech duration | `1.0` | Optional Piper tuning | Tune by listening |
| `PIPER_NOISE_SCALE` | Controls voice variation/noise | `0.667` | Optional Piper tuning | Tune by listening |
| `PIPER_NOISE_W` | Controls phoneme timing variation | `0.8` | Optional Piper tuning | Tune by listening |
| `PIPER_SENTENCE_SILENCE` | Silence inserted between sentences | `0.2` | Optional Piper tuning | Tune by listening |

## Sonos relay (advanced / optional)

Skip this section unless you want Sonos playback.

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `SONOS_RELAY_URL` | Primary HTTP relay endpoint that plays generated audio on Sonos | `http://192.168.1.50:5005/play-audio` | Sonos playback | Your local Sonos relay service |
| `SONOS_RELAY_PI_URL` | Alias for the primary LAN or Raspberry Pi relay | `http://192.168.1.60:5005/play-audio` | Sonos playback | Your local Sonos relay service |
| `SONOS_RELAY_FALLBACK_URL` | Secondary relay used if the primary fails | `http://192.168.1.61:5005/play-audio` | Sonos failover | Your backup relay service |
| `SONOS_RELAY_AUTH_BEARER` | Optional auth token for the relay | `replace-with-relay-token-if-needed` | Protected Sonos relay | Your relay auth config |
| `SONOS_RELAY_TIMEOUT_MS` | Timeout per relay attempt | `12000` | Sonos playback | Choose how long to wait before failover |
| `SONOS_ROOM_DEFAULT` | Default Sonos room when the request does not specify one | `Kitchen` | Sonos playback | Exact room name from your Sonos setup |

## Desktop client

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `VOICE_CLIENT_SERVICE_URL` | Base URL for the voice service used by the desktop client | `http://127.0.0.1:8787` | Desktop client | The address where your voice server is running |
| `VOICE_CLIENT_API_PATH` | API route used for voice turns | `/api/voice/turn` | Desktop client | Usually keep the default |
| `VOICE_CLIENT_BEARER_TOKEN` | Token the desktop client sends to the voice service | `mytoken123` | Desktop client | Same source as `VOICE_API_BEARER_TOKEN` or a dedicated token |
| `VOICE_CLIENT_SESSION_ID` | Friendly label sent with desktop requests | `OfficeDesk` | Desktop client | Choose any label you will recognize |
| `VOICE_CLIENT_SONOS_ROOM` | Default Sonos room for that desktop station | `Office` | Desktop + Sonos | Exact Sonos room name |
| `VOICE_CLIENT_OUTPUT_DIR` | Folder for temporary recordings and reply audio | `/tmp/openclaw-voice-client` | Desktop client | Choose any writable folder |
| `VOICE_CLIENT_RECORD_COMMAND` | Command used to record a short clip | `sox -q -d -c 1 -r 16000 "{output}" trim 0 5` | Desktop client | Usually keep the default if `sox` works |
| `VOICE_CLIENT_PLAY_COMMAND` | Optional command for local playback of replies | `afplay "{output}"` | Desktop client with local playback | Choose a player installed on your OS |

## Desktop wake and ambient options

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `VOICE_CLIENT_WAKE_MODE` | Main trigger mode for the desktop client | `auto` | Desktop client | Choose `auto`, `wake-word`, `hotkey`, `manual`, or `ambient` |
| `VOICE_CLIENT_AMBIENT_MODE` | Enables timed ambient captures alongside the normal mode | `false` | Optional ambient desktop mode | Set `true` only if you want periodic automatic turns |
| `VOICE_CLIENT_AMBIENT_INTERVAL_MS` | Delay between ambient captures | `20000` | Optional ambient desktop mode | Pick the interval you want |
| `VOICE_CLIENT_AMBIENT_AUTO_START` | Starts ambient mode immediately on launch | `true` | Optional ambient desktop mode | Choose whether the loop should start itself |
| `VOICE_CLIENT_WAKE_WORD_ENABLED` | Turns wake-word listening on or off | `true` | Wake-word desktop mode | Use `false` if you only want hotkey/manual |
| `VOICE_CLIENT_HOTKEY_ENABLED` | Turns the fallback hotkey on or off | `true` | Hotkey desktop mode | Use `false` if you only want wake-word/manual |
| `VOICE_CLIENT_WAKE_COOLDOWN_MS` | Minimum gap between wake triggers | `2500` | Wake-word or hotkey desktop mode | Tune to reduce accidental repeats |
| `VOICE_CLIENT_WAKE_BEEP_ENABLED` | Plays a confirmation beep on wake trigger | `true` | Wake-word or hotkey desktop mode | Set `false` if you want silent wake confirmation |
| `VOICE_CLIENT_WAKE_BEEP_COMMAND` | Optional extra command to play a custom sound | `(leave blank)` | Optional custom wake sound | Your local audio player command |

## Porcupine wake word (advanced / optional)

Skip this section unless you want a spoken wake phrase.

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `PORCUPINE_ACCESS_KEY` | Credential for Picovoice Porcupine | `replace-with-picovoice-access-key` | Wake-word desktop mode | Picovoice console |
| `VOICE_CLIENT_PORCUPINE_KEYWORD_PATH` | Absolute path to the `.ppn` wake keyword file | `/Users/alex/Downloads/Hey-OpenClaw.ppn` | Wake-word desktop mode | Picovoice keyword download |
| `VOICE_CLIENT_PORCUPINE_MODEL_PATH` | Optional absolute path to a custom Porcupine model file | `/Users/alex/Downloads/porcupine_params.pv` | Some wake-word setups only | Picovoice model file if you use one |
| `VOICE_CLIENT_PORCUPINE_SENSITIVITY` | Wake-word detector sensitivity | `0.5` | Wake-word desktop mode | Tune based on false positives vs misses |
| `VOICE_CLIENT_PORCUPINE_DEVICE_INDEX` | Input device index for wake-word recording | `-1` | Special audio hardware setups | Use default unless you need a specific mic |

## Global hotkey (advanced / optional)

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `VOICE_CLIENT_HOTKEY_KEY` | Main key in the global shortcut | `SPACE` | Hotkey desktop mode | Pick a supported key name |
| `VOICE_CLIENT_HOTKEY_MODIFIERS` | Modifier keys used with the hotkey | `CTRL+SHIFT` | Hotkey desktop mode | Pick the modifier combination you want |

## Beginner notes for key terms

- `localhost`: a special address that means "this computer"
- `endpoint`: the exact URL where a program expects requests
- `bearer token`: a secret string used like a password for API requests
- `absolute path`: the full path to a file from the top of the drive
- `wake word`: the spoken phrase that starts recording, such as "Hey OpenClaw"

Token reminder:

- `VOICE_API_BEARER_TOKEN` is for clients calling this voice server.
- `OPENCLAW_AUTH_BEARER` is for this voice server calling upstream OpenClaw.
