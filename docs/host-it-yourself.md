# Host It Yourself

Use this guide if you are setting up and running OpenClaw Voice on your own machine.

If you only want to use an already-running service, stop here and open `docs/user-guide.md` instead.

## Before you touch the terminal

If you are not comfortable with terminal commands, use the browser-only path in `docs/user-guide.md` or ask whoever hosts OpenClaw for your URL and token.

## I just want voice in my browser

You do **not** need to self-host the whole project just to talk to OpenClaw in a web page.

Do this instead:

1. Ask the host for your OpenClaw Voice web link.
2. Ask the host for your voice access token.
3. Open the link in Chrome, Edge, Safari, or Firefox.
4. Click **Allow** when the browser asks for microphone access.
5. Paste the token into **Access Token**.
6. Click **Save Settings**.
7. Hold **Hold to Talk**, speak, and release.

Use the rest of this guide only if you are setting up the server yourself.

## What this guide covers

- how to get the project onto your computer
- how to open Terminal or Command Prompt
- how to move into the project folder
- how to fill `.env`
- how to start the voice server
- how to fix the most common first-run errors

## Beginner quick start

### 1. Get the project files

If someone already sent you a ZIP of the project, extract it somewhere easy to find such as your Desktop.

If you are downloading from GitHub:

1. Open <https://github.com/brokemac79/openclaw-voice>.
2. Click **Code**.
3. Click **Download ZIP**.
4. Extract the ZIP.

You can also clone with Git if you already use it:

```bash
git clone https://github.com/brokemac79/openclaw-voice.git
```

### 2. Open a command window

- macOS: open `Terminal`
- Windows: open `Command Prompt`, `PowerShell`, or `Windows Terminal`
- Linux: open your normal terminal app

### 3. Move into the project folder

`cd` means "change directory". It tells the terminal to move into a folder.

Example:

```bash
cd ~/Downloads/openclaw-voice
```

Windows example:

```powershell
cd $HOME\Downloads\openclaw-voice
```

Success check: running `pwd` (macOS/Linux) or `Get-Location` (PowerShell) should show the project folder.

### 4. Install Node.js dependencies

Install Node.js 20 or newer first if you do not already have it.

Copy and paste this command to install the JavaScript packages this project needs:

```bash
npm install
```

What it does: downloads the packages listed in `package.json`.

Success check: the command finishes without a red error block and creates a `node_modules` folder.

If Windows says `npm` is not recognized, jump to [First-run troubleshooting](#first-run-troubleshooting).

### 5. Create your `.env` file

This file stores the addresses and tokens the app needs.

macOS/Linux:

```bash
cp .env.example .env
```

What it does: makes a new `.env` file by copying the example file.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

What it does: makes the same copy on Windows PowerShell.

Then open `.env` in a text editor and fill the values you need.

At minimum, beginners usually need:

- `VOICE_API_BEARER_TOKEN`
- `OPENCLAW_URL`

Example minimum values:

```env
VOICE_API_BEARER_TOKEN=mytoken123
OPENCLAW_URL=http://192.168.1.10:3000/api/chat
OPENCLAW_METHOD=POST
OPENCLAW_INPUT_FIELD=input
OPENCLAW_OUTPUT_FIELD=response
```

Use your real token and real HTTP API address. Do not use a `ws://` or `wss://` address here.

Use `docs/env-reference.md` for what each value means, where to get it, and example values.

### 6. Install the local speech prerequisites

OpenClaw Voice uses local speech-to-text through Python and `faster-whisper`.

Install Python 3 and check it:

```bash
python3 --version
python3 -m pip --version
```

What it does: confirms Python and pip are available before you install speech-to-text tools.

Windows PowerShell alternative:

```powershell
py --version
py -m pip --version
```

Create a virtual environment:

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
```

What it does:

- creates a private Python environment for this project
- turns it on in your current terminal
- upgrades pip inside that private environment

Windows Command Prompt:

```cmd
py -m venv .venv
.venv\Scripts\activate.bat
py -m pip install --upgrade pip
```

Windows PowerShell:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
py -m pip install --upgrade pip
```

Install `ffmpeg` and `faster-whisper`:

- macOS: `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y ffmpeg`
- Windows with Chocolatey: `choco install ffmpeg -y`

Then:

```bash
python3 -m pip install faster-whisper
```

What it does: installs the speech-to-text package OpenClaw Voice uses.

Windows alternative:

```powershell
py -m pip install faster-whisper
```

Success checks:

```bash
ffmpeg -version
```

What it does: the first command confirms `ffmpeg` is installed.

Make a small test audio file yourself so you do not need a pre-existing `test.wav`:

```bash
ffmpeg -f lavfi -i "anullsrc=r=16000:cl=mono" -t 2 test.wav
```

What it does: creates a 2-second silent WAV file named `test.wav` in the project folder.

Now run the speech-to-text smoke test:

```bash
python3 scripts/faster_whisper_transcribe.py --audio-path test.wav --model base.en
```

What it does: runs the local transcription helper against the test file you just created.

Success output should include JSON with keys like `text`, `language`, and `duration`.

### 7. Start the server

Copy and paste this command to start the local web server:

```bash
npm run dev
```

What it does: starts OpenClaw Voice on your computer.

Success check: you should see a line like this:

```text
openclaw-voice server listening on :8787
```

Then open `http://localhost:8787` in your browser.

`localhost` means "this same computer." It is a safe local-only address used for software running on your machine.

## Recommended first validation

1. Check the health endpoint:

   ```bash
   curl http://localhost:8787/health
   ```

   Expected result:

   ```json
   {"ok":true}
   ```

2. Open the browser page.
3. Allow microphone access.
4. Paste your voice token.
5. Hold **Hold to talk**, speak, and release.

What success looks like:

- the **Hold to Talk** button is enabled
- your words appear under **Transcription**
- the OpenClaw reply appears on screen

![Example browser screen with the saved settings card and voice results](assets/browser-ui-example.svg)

## First-run troubleshooting

### `npm` not found

Diagnosis: Node.js is not installed, or your terminal cannot find it yet.

Fix:

1. Install Node.js 20+ from <https://nodejs.org/>.
2. Fully close and reopen the terminal.
3. Run `node --version` and `npm --version`.

### `python3` not found

Diagnosis: Python 3 is not installed, or Windows uses `py` instead of `python3`.

Fix:

1. Install Python 3 from <https://www.python.org/downloads/>.
2. On Windows, try `py --version`.
3. Reopen the terminal after install.

### `ffmpeg` not found

Diagnosis: the audio decoder dependency is missing.

Fix:

1. Install `ffmpeg` for your platform.
2. Reopen the terminal.
3. Run `ffmpeg -version` again.

### Microphone permission denied

Diagnosis: your browser or operating system blocked microphone access.

Fix:

1. Open browser site permissions for the OpenClaw Voice page.
2. Change microphone access to **Allow**.
3. Reload the page.
4. On macOS or Windows, also check the system privacy settings if the browser still cannot record.

### Invalid URL or bad endpoint

Diagnosis: `OPENCLAW_URL` points at the wrong place.

Plain-English rule: use the real HTTP API address, not a website home page and not a `ws://` websocket address.

Fix:

1. Make sure `OPENCLAW_URL` starts with `http://` or `https://`.
2. Make sure it points at the chat API path, such as `/api/chat`.
3. If you get `404`, the path is usually wrong.
4. If you get `405`, the endpoint usually does not accept the configured HTTP method.

### Token rejected or authentication failed

Diagnosis: the bearer token is blank, wrong, expired, or meant for a different service.

`Bearer token` means a secret access string sent with your request so the service knows you are allowed to use it.

Fix:

1. Paste the token again exactly.
2. Confirm you put it in the correct variable.
3. Generate a fresh token if your upstream service rotates them.
4. Restart the server after editing `.env`.

## Where to go next

- Just want to use the web app: `docs/user-guide.md`
- Want the always-on desktop client: `docs/desktop-client-walkthrough.md`
- Need every environment variable explained: `docs/env-reference.md`
