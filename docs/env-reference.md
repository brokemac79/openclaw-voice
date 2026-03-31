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
| OpenClaw gateway token for CLI fallback | Token from your OpenClaw gateway auth settings | `.env` -> `OPENCLAW_GATEWAY_TOKEN` |

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
| `OPENCLAW_CLI_FALLBACK_ENABLED` | Enables local CLI fallback only for `/v1/*` 403 scope regressions | `true` | OpenClaw `2026.3.28` `/v1` token-scope regression workaround | Set manually when you hit `missing scope: operator.read/operator.write` on `/v1` |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway token exported to the local `openclaw` CLI process during fallback turns | `replace-with-openclaw-gateway-token` | Required for systemd CLI fallback when `OPENCLAW_CLI_FALLBACK_ENABLED=true` and `openclaw` expects gateway token auth | Your OpenClaw gateway auth settings |
| `OPENCLAW_CLI_BIN` | OpenClaw CLI executable used for fallback turns | `openclaw` | CLI fallback mode | Your local PATH or absolute binary path |
| `OPENCLAW_HTTP_SESSION_ID` | Default session id injected into HTTP-path voice turns so they appear in Mission Control; falls back to `OPENCLAW_CLI_SESSION_ID`, then `openclaw-voice` | `my-voice-session` | HTTP path (any mode) | Choose any stable session label visible in Mission Control |
| `OPENCLAW_CLI_SESSION_ID` | Default CLI session id when browser request omits `sessionId`; also used as fallback for `OPENCLAW_HTTP_SESSION_ID` | `openclaw-voice` | CLI fallback mode | Choose any stable session label |
| `OPENCLAW_CLI_AGENT` | Optional explicit OpenClaw agent id for fallback turns | `ops` | Multi-agent OpenClaw setups using fallback | Your OpenClaw agent config |
| `OPENCLAW_CLI_TIMEOUT_MS` | Timeout for one fallback CLI turn | `120000` | CLI fallback mode | Set based on expected local model latency |
| `OPENCLAW_VOICE_SYSTEM_PROMPT` | System prompt injected into CLI fallback turns to encourage spoken, non-markdown responses | `You are a voice assistant. Respond conversationally without markdown formatting. Avoid asterisks, bullet points, numbered lists, headers, and code blocks. Spell out numbers naturally. Keep answers concise and direct.` | CLI fallback mode | Override when you want a different voice persona or response style; leave unset to use the built-in default |

## Speech-to-text (STT)

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `STT_PROVIDER` | Which speech-to-text engine to use | `faster-whisper` | All self-hosted setups with server-side transcription | Choose `faster-whisper` (default), `browser`, `openai-whisper`, `google`, `deepgram`, `vosk`, or `azure` |

### faster-whisper (default, local)

The default provider. Runs transcription locally using the `faster-whisper` Python package. No API key required.

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `FASTER_WHISPER_PYTHON_BIN` | Python command used to run the transcription helper | `python3` | `STT_PROVIDER=faster-whisper` | The Python executable available on your machine |
| `FASTER_WHISPER_MODEL` | Speech model size and language | `base.en` | `STT_PROVIDER=faster-whisper` | Choose from faster-whisper model options |
| `FASTER_WHISPER_LANGUAGE` | Language hint for transcription | `en` | `STT_PROVIDER=faster-whisper` | Pick the spoken language you expect |
| `FASTER_WHISPER_DEVICE` | Hardware target for transcription | `auto` | `STT_PROVIDER=faster-whisper` | Usually `auto` or `cpu` |
| `FASTER_WHISPER_COMPUTE_TYPE` | Performance and memory setting | `int8` | `STT_PROVIDER=faster-whisper` | Usually keep the default for CPU use |
| `FASTER_WHISPER_TIMEOUT_MS` | Max wait time before a transcription is treated as failed | `120000` | `STT_PROVIDER=faster-whisper` | Pick a timeout that matches your hardware |

### browser (advanced / optional)

With `STT_PROVIDER=browser`, speech recognition runs entirely in the browser via the Web Speech API. The server does not receive or process any audio file. Instead, the browser submits the transcribed text in the `transcription` field of the request body. No server-side Python setup is required.

There are no additional environment variables for this provider.

### openai-whisper (advanced / optional)

Skip this section unless you want cloud transcription via the OpenAI Whisper API. Requires an OpenAI API key.

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `OPENAI_API_KEY` | Your OpenAI API key | `sk-...` | `STT_PROVIDER=openai-whisper` | [OpenAI dashboard](https://platform.openai.com/account/api-keys) |
| `OPENAI_WHISPER_MODEL` | Whisper model variant to request | `whisper-1` | `STT_PROVIDER=openai-whisper` | OpenAI API docs; usually keep the default |
| `OPENAI_WHISPER_LANGUAGE` | Language hint sent to the API | `en` | `STT_PROVIDER=openai-whisper` | Optional; omit for auto-detect |
| `OPENAI_WHISPER_BASE_URL` | Base URL for the OpenAI-compatible Whisper endpoint | `https://api.openai.com` | `STT_PROVIDER=openai-whisper` | Change only if you are using a self-hosted or compatible endpoint |

### google (advanced / optional)

Skip this section unless you want cloud transcription via the Google Cloud Speech-to-Text API. Requires a Google API key.

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `GOOGLE_STT_API_KEY` | Your Google Cloud API key with Speech-to-Text enabled | `AIza...` | `STT_PROVIDER=google` | [Google Cloud console](https://console.cloud.google.com) |
| `GOOGLE_STT_LANGUAGE_CODE` | BCP-47 language code for transcription | `en-US` | `STT_PROVIDER=google` | Google Speech-to-Text language support docs |
| `GOOGLE_STT_MODEL` | Google STT model to use | `default` | `STT_PROVIDER=google` | Optional; `default` works for most use cases |

### deepgram (advanced / optional)

Skip this section unless you want cloud transcription via the Deepgram API.

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `DEEPGRAM_API_KEY` | Your Deepgram API key | `abc123...` | `STT_PROVIDER=deepgram` | [Deepgram console](https://console.deepgram.com) |
| `DEEPGRAM_MODEL` | Deepgram transcription model | `nova-2` | `STT_PROVIDER=deepgram` | Deepgram docs; `nova-2` is the recommended default |
| `DEEPGRAM_LANGUAGE` | Language code for transcription | `en` | `STT_PROVIDER=deepgram` | Deepgram language support docs |

### vosk (advanced / optional)

Skip this section unless you want fully offline transcription using Vosk. Requires a downloaded Vosk model directory and Python packages.

Install first: `pip install vosk soundfile`

Download a model from <https://alphacephei.com/vosk/models> and unzip it to a local directory.

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `VOSK_MODEL_PATH` | Absolute path to the unzipped Vosk model directory | `/opt/vosk/vosk-model-en-us-0.22` | `STT_PROVIDER=vosk` | Unzip a model downloaded from the Vosk models page |
| `VOSK_PYTHON_BIN` | Python executable used to run the Vosk transcription helper | `python3` | `STT_PROVIDER=vosk` | The Python executable in your venv or system PATH |
| `VOSK_TIMEOUT_MS` | Max wait time for a Vosk transcription | `120000` | `STT_PROVIDER=vosk` | Increase if transcription times out on slow hardware |

### azure (advanced / optional)

Skip this section unless you want cloud transcription via Azure Cognitive Services Speech.

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `AZURE_SPEECH_KEY` | Your Azure Cognitive Services subscription key | `abc123...` | `STT_PROVIDER=azure` | [Azure portal](https://portal.azure.com) — Speech resource keys |
| `AZURE_SPEECH_REGION` | Azure region where your Speech resource is deployed | `eastus` | `STT_PROVIDER=azure` | Azure portal — Speech resource overview |
| `AZURE_SPEECH_LANGUAGE` | BCP-47 language code for transcription | `en-US` | `STT_PROVIDER=azure` | Azure Speech language support docs |

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
| `TTS_PROVIDER` | Which text-to-speech engine to use first | `edge` | Spoken replies | Choose `edge`, `piper`, `elevenlabs`, or `auto` |
| `TTS_FALLBACK_PROVIDER` | Backup TTS provider if the main one fails | `piper` | Edge with Piper fallback | Usually leave `piper` if you install Piper |

## ElevenLabs TTS (advanced / optional)

Skip this section unless you want cloud-based ElevenLabs speech output.

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key | `sk_abc123...` | ElevenLabs output | [ElevenLabs dashboard](https://elevenlabs.io) |
| `ELEVENLABS_VOICE_ID` | Voice to use for synthesis | `onwK4e9ZLuTAKqWW03F9` | ElevenLabs output | ElevenLabs voice library (default is "Daniel", British English) |
| `ELEVENLABS_MODEL` | Model ID for synthesis | `eleven_monolingual_v1` | ElevenLabs output | ElevenLabs docs — use `eleven_multilingual_v2` for non-English |

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
| `SONOS_VPS_RELAY_PORT` | Port used by the in-repo Sonos relay service (`npm run sonos:relay`) | `8788` | In-repo relay deployment | Pick an open port on the relay host |
| `SONOS_VPS_RELAY_PATH` | HTTP path that accepts voice-server relay payloads | `/play` | In-repo relay deployment | Keep default unless you need a custom route |
| `SONOS_VPS_RELAY_AUTH_BEARER` | Bearer token required by the in-repo relay endpoint | `replace-with-relay-token` | Protected in-repo relay | Choose a random token and mirror it into `SONOS_RELAY_AUTH_BEARER` |
| `SONOS_HTTP_API_URL` | Base URL for `node-sonos-http-api` used by the in-repo relay | `http://127.0.0.1:5005` | In-repo relay deployment | URL where your Sonos HTTP API runs |
| `SONOS_HTTP_API_AUTH_BEARER` | Optional bearer token for Sonos HTTP API requests from the in-repo relay | `replace-with-sonos-http-api-token` | Protected Sonos HTTP API | Sonos HTTP API auth config |
| `SONOS_RELAY_PUBLIC_BASE_URL` | Public/reachable base URL that Sonos uses to fetch temp audio clips from the relay | `http://192.168.1.50:8788` | In-repo relay deployment | Use an address reachable from Sonos speakers |
| `SONOS_RELAY_MEDIA_TTL_MS` | How long temp relay audio files stay available before cleanup | `900000` | In-repo relay deployment | Usually keep 10 to 20 minutes |
| `SONOS_RELAY_MAX_AUDIO_BYTES` | Max accepted payload size for relay audio uploads | `15728640` | In-repo relay deployment | Tune based on expected clip size |

## Desktop client

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `VOICE_CLIENT_SERVICE_URL` | Base URL for the voice service used by the desktop client | `http://127.0.0.1:8787` | Desktop client | The address where your voice server is running |
| `VOICE_CLIENT_API_PATH` | API route used for voice turns | `/api/voice/turn` | Desktop client | Usually keep the default |
| `VOICE_CLIENT_BEARER_TOKEN` | Token the desktop client sends to the voice service | `mytoken123` | Desktop client | Same source as `VOICE_API_BEARER_TOKEN` or a dedicated token |
| `VOICE_CLIENT_SESSION_ID` | Friendly label sent with desktop requests | `OfficeDesk` | Desktop client | Choose any label you will recognize |
| `VOICE_CLIENT_SONOS_ROOM` | Default Sonos room for that desktop station | `Office` | Desktop + Sonos | Exact Sonos room name |
| `VOICE_CLIENT_OUTPUT_DIR` | Folder for temporary recordings and reply audio | `/tmp/openclaw-voice-client` | Desktop client | Choose any writable folder |
| `VOICE_CLIENT_RECORD_COMMAND` | Command used to record a short clip | `sox -q -d -c 1 -r 16000 "{output}" trim 0 5` (macOS/Linux) or `sox.exe -q -t waveaudio default -c 1 -r 16000 "{output}" trim 0 5` (Windows) | Desktop client | Keep default for your OS; Windows must use `-t waveaudio default` |
| `VOICE_CLIENT_PLAY_COMMAND` | Optional command for local playback of replies | `afplay "{output}"` (macOS), `mpg123 "{output}"` (Linux), or `powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command "$p=New-Object -ComObject WMPlayer.OCX; $m=$p.newMedia('{output}'); $p.currentPlaylist.appendItem($m); $p.controls.play(); while($p.playState -ne 1){Start-Sleep -Milliseconds 200}"` (Windows) | Desktop client with local playback | Choose a player installed on your OS (Windows defaults to hidden playback if unset) |

## Desktop wake and ambient options

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `VOICE_CLIENT_WAKE_MODE` | Main trigger mode for the desktop client | `auto` | Desktop client | Choose `auto`, `wake-word`, `hotkey`, `manual`, or `ambient` |
| `VOICE_CLIENT_AMBIENT_MODE` | Enables timed ambient captures alongside the normal mode | `false` | Optional ambient desktop mode | Set `true` only if you want periodic automatic turns |
| `VOICE_CLIENT_AMBIENT_INTERVAL_MS` | Delay between ambient captures | `20000` | Optional ambient desktop mode | Pick the interval you want |
| `VOICE_CLIENT_AMBIENT_AUTO_START` | Starts ambient mode immediately on launch | `true` | Optional ambient desktop mode | Choose whether the loop should start itself |
| `VOICE_CLIENT_WAKE_WORD_ENABLED` | Turns wake-word listening on or off | `true` | Wake-word desktop mode | Use `false` if you only want hotkey/manual |
| `VOICE_CLIENT_HOTKEY_ENABLED` | Turns the fallback hotkey on or off | `true` | Hotkey desktop mode | Use `false` if you only want wake-word/manual, or as a Windows fallback if `node-global-key-listener` fails to spawn |
| `VOICE_CLIENT_WAKE_COOLDOWN_MS` | Minimum gap between wake triggers | `2500` | Wake-word or hotkey desktop mode | Tune to reduce accidental repeats |
| `VOICE_CLIENT_WAKE_BEEP_ENABLED` | Plays a confirmation beep on wake trigger | `true` | Wake-word or hotkey desktop mode | Set `false` if you want silent wake confirmation |
| `VOICE_CLIENT_WAKE_BEEP_COMMAND` | Optional extra command to play a custom sound | `(leave blank)` | Optional custom wake sound | Your local audio player command |

## Wake word provider selection (advanced / optional)

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `VOICE_CLIENT_WAKE_PROVIDER` | Which wake word engine to use | `porcupine` | Wake-word desktop mode | Choose `porcupine` (default) or `openwakeword` |

## Porcupine wake word (advanced / optional)

Skip this section unless you want a spoken wake phrase using Porcupine (requires a Picovoice account).

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `PORCUPINE_ACCESS_KEY` | Credential for Picovoice Porcupine | `replace-with-picovoice-access-key` | Porcupine wake-word mode | Picovoice console |
| `VOICE_CLIENT_PORCUPINE_KEYWORD_PATH` | Absolute path to the `.ppn` wake keyword file | `/Users/alex/Downloads/Hey-OpenClaw.ppn` | Porcupine wake-word mode | Picovoice keyword download |
| `VOICE_CLIENT_PORCUPINE_MODEL_PATH` | Optional absolute path to a custom Porcupine model file | `/Users/alex/Downloads/porcupine_params.pv` | Some Porcupine setups only | Picovoice model file if you use one |
| `VOICE_CLIENT_PORCUPINE_SENSITIVITY` | Wake-word detector sensitivity | `0.5` | Porcupine wake-word mode | Tune based on false positives vs misses |
| `VOICE_CLIENT_PORCUPINE_DEVICE_INDEX` | Input device index for wake-word recording | `-1` | Special audio hardware setups | Use default unless you need a specific mic |

## OpenWakeWord (advanced / optional)

OpenWakeWord is a free, open-source alternative to Porcupine. No account or API key is required. Set `VOICE_CLIENT_WAKE_PROVIDER=openwakeword` to use it.

Install first: `pip install openwakeword pyaudio numpy`

| Variable | What it is | Example value | Needed for | Where to get it |
| --- | --- | --- | --- | --- |
| `VOICE_CLIENT_OWW_MODEL` | Wake word model name or path | `hey_jarvis` | OpenWakeWord mode | Pre-trained model names: `hey_jarvis`, `alexa`, `hey_mycroft`, `hey_rhasspy`; or a path to a custom `.tflite` model |
| `VOICE_CLIENT_OWW_THRESHOLD` | Detection score threshold (0.0–1.0) | `0.5` | OpenWakeWord mode | Lower = more sensitive, higher = fewer false positives |
| `VOICE_CLIENT_OWW_PYTHON_BIN` | Python executable used to run the OpenWakeWord sidecar | `python3` | OpenWakeWord mode | The Python executable in your venv or system PATH |
| `VOICE_CLIENT_OWW_INFERENCE_FRAMEWORK` | Inference backend for OpenWakeWord | `onnx` | OpenWakeWord mode | `onnx` (default, works everywhere) or `tflite` (Linux/Mac only with Python <3.12) |

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
- `OPENCLAW_GATEWAY_TOKEN` is for local `openclaw` CLI fallback turns and must live in the same `.env` file loaded by `systemd` `EnvironmentFile=`.
