# OpenClaw Voice User Guide

OpenClaw Voice lets you press a button or use a wake trigger, speak naturally, and hear OpenClaw answer back.

Phase 4 supports both the browser UI and an optional desktop client with wake-word, hotkey, and ambient always-on activation. Speech transcription runs locally with faster-whisper.

If you are deploying or administering the service, use `README.md` instead. This guide is for end users only.

You can use OpenClaw Voice in two ways:

- **Browser mode**: open the web page on your phone, tablet, or computer
- **Desktop mode**: use a desktop or mini-PC that stays on and sends voice turns from a command window

## What You Need Before You Start

- A phone, tablet, or computer with a microphone
- A supported web browser with microphone access enabled, or a desktop setup prepared by your administrator
- Your OpenClaw Voice web link
- Your voice access token from the person who set up the system
- If you use Sonos playback, the Sonos room name your administrator told you to use

## Browser Compatibility

Best experience:

- Chrome (desktop + Android)
- Edge (desktop)
- Safari (iOS 16.4+ and macOS Safari 16.4+)

Safari 16.4+ is supported with automatic audio MIME fallback handling during upload.

Also supported:

- Firefox current version (desktop)

If your browser is older and recording does not work, update the browser first.

## First-Time Setup

### Browser mode

1. Open the OpenClaw Voice page in your browser.
2. When your browser asks for microphone access, choose **Allow**.
3. In the **Settings** card at the top of the page, check that **Voice Service URL** matches the service address you were given.
4. In **Access Token**, paste the voice access token you were given.
5. If your household or project uses a room label, enter it in **Room Name (optional)**. Otherwise, leave it blank.
6. Click **Save Settings**.
7. Check the saved summary under the Settings card. It should show your service URL, room name if used, and a masked token.
8. Wait for the status message to say the app is ready.

### Desktop mode

If your administrator set up the desktop voice client for you:

1. Open the terminal or command window they provided.
2. Start the client with `npm run desktop:client` unless they already configured it to start automatically.
3. Wait for the message that says `OpenClaw desktop voice client started.`
4. Say the configured wake phrase (for example **Hey OpenClaw**) or use the fallback hotkey your administrator configured.
5. Listen for the short confirmation beep, then speak naturally.
6. Wait for the transcript and reply text to print in the window.
7. If reply audio is enabled, listen for playback on the local device or on the configured Sonos room.

If your administrator left the client in `manual` mode, pressing **Enter** still starts a recording without the wake word or hotkey.

If the client is configured for ambient mode, it can also record on a timer without waiting for a manual trigger.

If the desktop client is meant to stay available all day, ask your administrator to run it as a background service so you do not need to restart it manually.

## How To Talk To OpenClaw

1. Press and hold **Hold to talk**.
2. Speak clearly while holding the button.
3. Release the button when you are done.
4. Wait while the app uploads your audio and gets a reply.
5. Read the text on screen or listen to the spoken response.

Keyboard users can also hold **Space** or **Enter** while the talk button is selected.

After each turn, the page shows:

- **Transcription**: what the app heard you say
- **OpenClaw Response**: the reply text before it is spoken aloud

In desktop mode, the same information appears in the terminal window after each recording.

Desktop mode supports these trigger paths:

- Wake word (Picovoice Porcupine)
- Global hotkey fallback
- Manual Enter key fallback
- Ambient loop mode (always-on periodic capture)

## If You Are Helping With Setup

Most people can skip this section. It is for the person preparing the service or desktop client.

### Faster-whisper settings

These settings control local speech transcription:

For a full beginner setup walkthrough (Python + pip + ffmpeg + smoke test), see `README.md` in the section `faster-whisper Python setup (beginner-friendly)`.

- `FASTER_WHISPER_PYTHON_BIN`: which Python command should run the transcription helper, usually `python3`
- `FASTER_WHISPER_MODEL`: which speech model to use, such as `base.en`
- `FASTER_WHISPER_LANGUAGE`: language hint, such as `en`
- `FASTER_WHISPER_DEVICE`: where to run transcription, usually `auto`
- `FASTER_WHISPER_COMPUTE_TYPE`: performance setting, usually `int8`
- `FASTER_WHISPER_TIMEOUT_MS`: how long to wait before a transcription attempt times out

### Sonos settings

Use these only if replies should play through Sonos:

- `SONOS_RELAY_URL` or `SONOS_RELAY_PI_URL`: primary local relay address that accepts generated audio
- `SONOS_RELAY_FALLBACK_URL`: optional secondary relay used during migration/failover
- `SONOS_RELAY_AUTH_BEARER`: optional relay bearer token
- `SONOS_RELAY_TIMEOUT_MS`: timeout per relay attempt before trying the fallback relay
- `SONOS_ROOM_DEFAULT`: fallback room name when a browser or desktop client does not send one

If a household uses more than one Sonos room, users can enter a room name in the browser settings or the desktop client can send `VOICE_CLIENT_SONOS_ROOM`.

### Desktop client settings

Use these when running the always-on desktop client:

- `VOICE_CLIENT_SERVICE_URL`: base address of the voice service
- `VOICE_CLIENT_API_PATH`: request path, usually `/api/voice/turn`
- `VOICE_CLIENT_BEARER_TOKEN`: token used by the desktop client; if blank, it can reuse `VOICE_API_BEARER_TOKEN`
- `VOICE_CLIENT_SESSION_ID`: friendly label for that desktop station
- `VOICE_CLIENT_SONOS_ROOM`: default Sonos room for that desktop station
- `VOICE_CLIENT_OUTPUT_DIR`: folder used to store temporary recordings and generated reply audio (defaults to your system temp directory)
- `VOICE_CLIENT_RECORD_COMMAND`: command used to capture a short recording
- `VOICE_CLIENT_PLAY_COMMAND`: optional command to play reply audio locally
- `VOICE_CLIENT_WAKE_MODE`: `auto`, `wake-word`, `hotkey`, `manual`, or `ambient`
- `VOICE_CLIENT_AMBIENT_MODE`: optional boolean flag to add ambient timed captures without switching away from the normal mode
- `VOICE_CLIENT_AMBIENT_INTERVAL_MS`: interval between ambient captures
- `VOICE_CLIENT_AMBIENT_AUTO_START`: whether ambient loop starts immediately
- `VOICE_CLIENT_WAKE_WORD_ENABLED`: whether the desktop client should listen for wake-word triggers
- `VOICE_CLIENT_HOTKEY_ENABLED`: whether the desktop client should listen for the fallback hotkey
- `VOICE_CLIENT_WAKE_COOLDOWN_MS`: minimum gap between wake triggers so the client does not retrigger too quickly
- `VOICE_CLIENT_WAKE_BEEP_ENABLED`: whether to play a confirmation beep on wake trigger
- `VOICE_CLIENT_WAKE_BEEP_COMMAND`: optional custom command run after the terminal beep
- `PORCUPINE_ACCESS_KEY`: credential for Picovoice wake-word detection
- `VOICE_CLIENT_PORCUPINE_KEYWORD_PATH`: absolute path to the `.ppn` wake-word file (for example the trained `Hey OpenClaw` keyword)
- `VOICE_CLIENT_PORCUPINE_MODEL_PATH`: optional absolute path to a Porcupine model file when you are not using the default
- `VOICE_CLIENT_PORCUPINE_SENSITIVITY`: wake-word sensitivity value used by the detector
- `VOICE_CLIENT_PORCUPINE_DEVICE_INDEX`: optional input device index used by Porcupine
- `VOICE_CLIENT_HOTKEY_KEY` and `VOICE_CLIENT_HOTKEY_MODIFIERS`: fallback global hotkey combination

If you are not using Sonos or the desktop client, you can leave those optional values blank.

### TTS provider settings

Phase 4 adds local Piper as a TTS option and fallback:

- `TTS_PROVIDER`: `edge`, `piper`, or `auto`
- `TTS_FALLBACK_PROVIDER`: currently supports `piper` fallback when `TTS_PROVIDER=edge`
- `PIPER_BIN`: Piper executable name or absolute path when it is not available as `piper`
- `PIPER_MODEL_PATH`: required when Piper is used
- Optional Piper tuning: `PIPER_SPEAKER_ID`, `PIPER_LENGTH_SCALE`, `PIPER_NOISE_SCALE`, `PIPER_NOISE_W`, `PIPER_SENTENCE_SILENCE`

If administrators want local-only speech output, they should set `TTS_PROVIDER=piper`, install the Piper CLI on the server, and point `PIPER_MODEL_PATH` at a downloaded voice model.

### Proactive alerts (doorbell/calendar/energy)

Administrators can trigger Sonos announcements without waiting for a user voice turn by calling `POST /api/voice/alerts` with bearer auth and a JSON payload containing `message` (or `text`) and optional `title`, `room`, and `source`.

They can verify the configured primary and fallback relay endpoints with `GET /api/sonos/relay/health` before relying on proactive announcements.

## Tips For Best Results

- Speak in a normal voice and stay close to the microphone.
- Wait for the ready message before starting a new request.
- Use a quiet room when possible.
- If the reply audio is hard to hear, raise your device volume and replay the audio player at the bottom of the page.

## Troubleshooting

### The talk button stays disabled

Check these first:

- Your browser allowed microphone access
- The **Access Token** field is filled in
- Your browser supports microphone recording

If needed, refresh the page and allow microphone access again.

### I see a microphone permission error

Your browser or device blocked microphone access. Open your browser settings, allow microphone use for this site, then reload the page.

### It says the access token is missing or invalid

The access token is blank, expired, or typed incorrectly. Paste the token again exactly as provided in **Access Token**. If it still fails, ask your administrator for a fresh token.

### The request fails after I record

This usually means the voice service, OpenClaw connection, or internet connection had a problem.

Try this:

1. Check that you are still online.
2. Record a shorter request.
3. Wait a few seconds and try again.
4. Contact your administrator if the problem keeps happening.

If you can share technical details with your administrator, include the exact error text shown on screen. Common server-side messages are `Voice pipeline failed`, `OpenClaw request failed (...)`, `faster_whisper_failed`, and Sonos relay errors.

### The reply text appears, but I do not hear audio

- Make sure your device volume is on.
- Press play on the audio player at the bottom of the page.
- If your phone is in silent mode, switch audio back on and try again.
- If your setup uses Sonos, confirm the correct room name was saved.

### Sonos playback does not start

- Check that the saved room name matches the Sonos room exactly.
- If your setup uses a shared default room, ask your administrator which room is configured.
- If the desktop client is sending audio to Sonos, confirm `VOICE_CLIENT_SONOS_ROOM` was set correctly.
- Ask your administrator to check whether the Sonos relay service is online.

### The desktop client does not respond

- Make sure the terminal window is still open.
- Try the wake phrase or configured hotkey first, then press **Enter** as fallback.
- If the client says wake-word setup is unavailable, ask your administrator to recheck `PORCUPINE_ACCESS_KEY` and the keyword file path.
- If the client says hotkey setup is unavailable, ask your administrator whether the desktop OS supports global keyboard capture for this session.
- If you see an authentication or missing token error, ask your administrator to recheck the desktop client environment settings.
- Restart the desktop client if it was not configured as a background service.

### The transcription is wrong

- Speak a little slower.
- Move closer to the microphone.
- Reduce background noise.
- Try again using a shorter sentence.

### I saved settings, but they disappear later

Settings are stored in your browser's local storage.

- Avoid private/incognito windows for daily use.
- Do not clear site data for the OpenClaw Voice page.
- If you changed browsers/devices, enter settings again on that browser/device.

## FAQ

### Do I need to install anything?

Usually no. The main experience still runs in a browser, so most people only need the web link, microphone permission, and an access token.

### Do I need to keep holding the button the whole time?

Yes. This version uses push-to-talk. Hold the button while speaking, then release it to send your request.

### What does Room Name mean?

It is an optional label that can help keep a conversation tied to a room, device, or user flow. If you were not told to use one, you can leave it blank.

### Can I use the keyboard instead of pressing the button?

Yes. If the talk button is selected, you can hold **Space** or **Enter** to record and release the key to send your request.

### Can I talk to it in the background?

Yes in desktop mode. Phase 4 adds wake-word, hotkey, and ambient triggers for always-on usage when configured by your administrator.

### Is there a desktop option?

Yes. Administrators can run the desktop voice client as a persistent process on a desktop or mini-PC. Ask your administrator if your setup includes this mode.

### Can replies play on Sonos?

Yes, if your administrator connected OpenClaw Voice to a Sonos relay on your local network. You may need to enter a room name, such as `Kitchen` or `Office`, in Settings.

### Who should I contact if setup does not work?

Contact the person who gave you the OpenClaw Voice link or token. They can confirm the service is online and verify your settings.
