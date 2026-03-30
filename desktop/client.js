import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

dotenv.config();

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const unixRecordCommandDefault = "sox -q -d -c 1 -r 16000 \"{output}\" trim 0 5";
const windowsRecordCommandDefault = "sox.exe -q -t waveaudio default -c 1 -r 16000 \"{output}\" trim 0 5";
const windowsPlayCommandDefault =
  "powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command \"$p=New-Object -ComObject WMPlayer.OCX; $m=$p.newMedia('{output}'); $p.currentPlaylist.appendItem($m); $p.controls.play(); while($p.playState -ne 1){Start-Sleep -Milliseconds 200}\"";

const serviceUrl = (process.env.VOICE_CLIENT_SERVICE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const apiPath = process.env.VOICE_CLIENT_API_PATH || "/api/voice/turn";
const bearerToken = process.env.VOICE_CLIENT_BEARER_TOKEN || process.env.VOICE_API_BEARER_TOKEN || "";
const sessionId = process.env.VOICE_CLIENT_SESSION_ID || "Desktop";
const sonosRoom = process.env.VOICE_CLIENT_SONOS_ROOM || "";
const recorderCommandTemplate = getRecorderCommandTemplate();
const playerCommandTemplate = getPlayerCommandTemplate();
const outputDir = process.env.VOICE_CLIENT_OUTPUT_DIR || path.join(os.tmpdir(), "openclaw-voice-client");
const wakeMode = (process.env.VOICE_CLIENT_WAKE_MODE || "auto").toLowerCase();
const ambientModeEnabled = wakeMode === "ambient" || parseBool(process.env.VOICE_CLIENT_AMBIENT_MODE, false);
const ambientIntervalMs = parseIntWithDefault(process.env.VOICE_CLIENT_AMBIENT_INTERVAL_MS, 20000);
const ambientAutoStart = parseBool(process.env.VOICE_CLIENT_AMBIENT_AUTO_START, true);
const wakeWordEnabled = parseBool(process.env.VOICE_CLIENT_WAKE_WORD_ENABLED, true);
const wakeHotkeyEnabled = parseBool(process.env.VOICE_CLIENT_HOTKEY_ENABLED, true);
const wakeCooldownMs = parseIntWithDefault(process.env.VOICE_CLIENT_WAKE_COOLDOWN_MS, 2500);
const wakeBeepEnabled = parseBool(process.env.VOICE_CLIENT_WAKE_BEEP_ENABLED, true);
const wakeBeepCommandTemplate = process.env.VOICE_CLIENT_WAKE_BEEP_COMMAND || "";

const porcupineAccessKey = process.env.PORCUPINE_ACCESS_KEY || "";
const porcupineKeywordPath = process.env.VOICE_CLIENT_PORCUPINE_KEYWORD_PATH || "";
const porcupineModelPath = process.env.VOICE_CLIENT_PORCUPINE_MODEL_PATH || "";
const porcupineSensitivity = parseFloatWithDefault(process.env.VOICE_CLIENT_PORCUPINE_SENSITIVITY, 0.5);
const porcupineDeviceIndex = parseIntWithDefault(process.env.VOICE_CLIENT_PORCUPINE_DEVICE_INDEX, -1);

const wakeProvider = (process.env.VOICE_CLIENT_WAKE_PROVIDER || "porcupine").trim().toLowerCase();
const owwPythonBin = process.env.VOICE_CLIENT_OWW_PYTHON_BIN || "python3";
const owwModel = process.env.VOICE_CLIENT_OWW_MODEL || "hey_jarvis";
const owwThreshold = parseFloatWithDefault(process.env.VOICE_CLIENT_OWW_THRESHOLD, 0.5);

const hotkeyKey = (process.env.VOICE_CLIENT_HOTKEY_KEY || "SPACE").trim().toUpperCase();
const hotkeyModifiers = (process.env.VOICE_CLIENT_HOTKEY_MODIFIERS || "CTRL+SHIFT")
  .split("+")
  .map((item) => item.trim().toUpperCase())
  .filter(Boolean);

if (!bearerToken) {
  throw new Error("Missing VOICE_CLIENT_BEARER_TOKEN (or VOICE_API_BEARER_TOKEN)");
}

await fs.promises.mkdir(outputDir, { recursive: true });

function parseBool(value, defaultValue) {
  if (value == null || value === "") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parseIntWithDefault(value, defaultValue) {
  if (value == null || value === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function parseFloatWithDefault(value, defaultValue) {
  if (value == null || value === "") {
    return defaultValue;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function toApiUrl() {
  return new URL(apiPath, `${serviceUrl}/`).toString();
}

function stamp() {
  return new Date().toISOString().replace(/[.:]/g, "-");
}

function getRecorderCommandTemplate() {
  const configured = process.env.VOICE_CLIENT_RECORD_COMMAND || "";
  const defaultTemplate = process.platform === "win32" ? windowsRecordCommandDefault : unixRecordCommandDefault;

  if (!configured) {
    return defaultTemplate;
  }

  if (process.platform !== "win32") {
    return configured;
  }

  const normalized = configured.trim();
  if (!/\bsox(?:\.exe)?\b/i.test(normalized) || !/(?:^|\s)-d(?:\s|$)/.test(normalized)) {
    return configured;
  }
  if (/\bwaveaudio\b/i.test(normalized)) {
    return configured;
  }

  process.stdout.write(
    "Detected Windows sox command using -d input; switching to -t waveaudio default for compatibility.\n"
  );
  return normalized.replace(/(?:^|\s)-d(?:\s|$)/, " -t waveaudio default ").replace(/\s+/g, " ").trim();
}

function getPlayerCommandTemplate() {
  const configured = process.env.VOICE_CLIENT_PLAY_COMMAND || "";

  if (!configured) {
    return process.platform === "win32" ? windowsPlayCommandDefault : "";
  }

  if (process.platform !== "win32") {
    return configured;
  }

  const normalized = configured.trim();
  if (!/\bstart-process\b/i.test(normalized)) {
    return configured;
  }

  process.stdout.write(
    "Detected Windows playback command using Start-Process; switching to a hidden Windows Media Player COM command for silent playback.\n"
  );
  return windowsPlayCommandDefault;
}

async function runTemplateCommand(template, outputPath) {
  const command = template.replace("{output}", outputPath || "");
  await execAsync(command, { maxBuffer: 2 * 1024 * 1024 });
}

async function recordClip() {
  const outputPath = path.join(outputDir, `recording-${stamp()}.wav`);
  await runTemplateCommand(recorderCommandTemplate, outputPath);
  return outputPath;
}

async function sendClip(audioPath) {
  const bytes = await fs.promises.readFile(audioPath);
  const form = new FormData();
  form.append("audio", new Blob([bytes], { type: "audio/wav" }), path.basename(audioPath));
  form.append("sessionId", sessionId);
  if (sonosRoom) {
    form.append("sonosRoom", sonosRoom);
  }

  const response = await fetch(toApiUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`
    },
    body: form
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.details || data.error || response.statusText);
  }

  return data;
}

async function writeReplyAudio(data) {
  if (!data?.audioBase64) {
    return null;
  }

  const outputPath = path.join(outputDir, `reply-${stamp()}.mp3`);
  await fs.promises.writeFile(outputPath, Buffer.from(data.audioBase64, "base64"));
  return outputPath;
}

async function maybePlayAudio(audioPath) {
  if (!audioPath || !playerCommandTemplate) {
    return;
  }

  await runTemplateCommand(playerCommandTemplate, audioPath);
}

async function maybePlayWakeBeep() {
  if (!wakeBeepEnabled) {
    return;
  }

  process.stdout.write("\u0007");

  if (wakeBeepCommandTemplate) {
    await runTemplateCommand(wakeBeepCommandTemplate, "");
  }
}

function areRequiredModifiersDown(down) {
  const modKeyMap = {
    CTRL: ["LEFT CTRL", "RIGHT CTRL", "LEFT CONTROL", "RIGHT CONTROL"],
    SHIFT: ["LEFT SHIFT", "RIGHT SHIFT"],
    ALT: ["LEFT ALT", "RIGHT ALT"],
    META: ["LEFT META", "RIGHT META", "LEFT SUPER", "RIGHT SUPER", "LEFT COMMAND", "RIGHT COMMAND"],
    CMD: ["LEFT META", "RIGHT META", "LEFT COMMAND", "RIGHT COMMAND"],
    WIN: ["LEFT META", "RIGHT META", "LEFT SUPER", "RIGHT SUPER"]
  };

  return hotkeyModifiers.every((modifier) => {
    const keys = modKeyMap[modifier];
    if (!keys) {
      return false;
    }
    return keys.some((keyName) => Boolean(down[keyName]));
  });
}

async function startPorcupineDetector(onWake) {
  if (!porcupineAccessKey || !porcupineKeywordPath) {
    throw new Error(
      "Porcupine wake word mode requires PORCUPINE_ACCESS_KEY and VOICE_CLIENT_PORCUPINE_KEYWORD_PATH"
    );
  }

  const [{ Porcupine }, { PvRecorder }] = await Promise.all([
    import("@picovoice/porcupine-node"),
    import("@picovoice/pvrecorder-node")
  ]);

  const porcupine = new Porcupine(
    porcupineAccessKey,
    [porcupineKeywordPath],
    [porcupineSensitivity],
    porcupineModelPath || undefined
  );
  const recorder = new PvRecorder(porcupine.frameLength, porcupineDeviceIndex);

  let active = true;
  let lastWakeAt = 0;

  recorder.start();

  const runLoop = (async () => {
    while (active) {
      const frame = await recorder.read();
      const keywordIndex = porcupine.process(frame);
      if (keywordIndex < 0) {
        continue;
      }

      const now = Date.now();
      if (now - lastWakeAt < wakeCooldownMs) {
        continue;
      }

      lastWakeAt = now;
      onWake("wake-word");
    }
  })();

  runLoop.catch((error) => {
    process.stderr.write(
      `Wake word loop stopped: ${error instanceof Error ? error.message : String(error)}\n`
    );
  });

  return async () => {
    active = false;
    try {
      recorder.stop();
    } catch {
      // ignored
    }
    recorder.release();
    porcupine.release();
  };
}

async function startOpenWakeWordDetector(onWake) {
  const scriptPath = path.join(__dirname, "..", "scripts", "openwakeword_detect.py");

  const args = [
    scriptPath,
    "--model", owwModel,
    "--threshold", String(owwThreshold)
  ];

  const child = spawn(owwPythonBin, args, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  let lastWakeAt = 0;
  let buffer = "";

  child.stdout.on("data", (chunk) => {
    buffer += String(chunk);
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.detected) {
          const now = Date.now();
          if (now - lastWakeAt >= wakeCooldownMs) {
            lastWakeAt = now;
            onWake("wake-word");
          }
        }
      } catch {
        // ignore non-JSON stdout lines
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (!text) {
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed.error) {
        process.stderr.write(`OpenWakeWord error: ${parsed.details || parsed.error}\n`);
        return;
      }
    } catch {
      // not JSON — pass through as-is
    }
    process.stderr.write(`openwakeword: ${text}\n`);
  });

  await new Promise((resolve, reject) => {
    // Give the process a moment to fail fast (e.g. missing package)
    const timer = setTimeout(resolve, 1500);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn OpenWakeWord sidecar: ${err.message}`));
    });

    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== null && code !== 0) {
        reject(new Error(`OpenWakeWord sidecar exited with code ${code} — check that openwakeword, pyaudio, and numpy are installed`));
      }
    });
  });

  return async () => {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignored
    }
  };
}

async function startWakeWordDetector(onWake) {
  if (!wakeWordEnabled) {
    return null;
  }

  if (wakeProvider === "openwakeword") {
    return startOpenWakeWordDetector(onWake);
  }

  return startPorcupineDetector(onWake);
}

async function startGlobalHotkeyListener(onWake) {
  if (!wakeHotkeyEnabled) {
    return null;
  }

  const { GlobalKeyboardListener } = await import("node-global-key-listener");
  const listener = new GlobalKeyboardListener();

  const handler = (event, down) => {
    if (event.state !== "DOWN") {
      return false;
    }
    if (event.name !== hotkeyKey) {
      return false;
    }
    if (!areRequiredModifiersDown(down)) {
      return false;
    }

    onWake("hotkey");
    return true;
  };

  try {
    await listener.addListener(handler);
  } catch (error) {
    if (typeof listener.kill === "function") {
      listener.kill();
    }
    throw error;
  }

  return async () => {
    listener.removeListener(handler);
    if (typeof listener.kill === "function") {
      listener.kill();
    }
  };
}

let isProcessingTurn = false;

async function runVoiceTurn(triggerSource) {
  if (isProcessingTurn) {
    process.stdout.write(`Ignored ${triggerSource} trigger while another turn is in progress.\n`);
    return;
  }

  isProcessingTurn = true;
  try {
    await maybePlayWakeBeep();
    process.stdout.write(`Wake trigger: ${triggerSource}\n`);
    process.stdout.write("Recording...\n");
    const clip = await recordClip();
    process.stdout.write(`Recorded: ${clip}\n`);
    process.stdout.write("Sending to voice service...\n");
    const reply = await sendClip(clip);
    process.stdout.write(`You said: ${reply.transcription || "(empty)"}\n`);
    process.stdout.write(`Assistant: ${reply.responseText || "(empty)"}\n`);
    if (reply.sonos?.routed) {
      process.stdout.write(`Sonos routed to room: ${reply.sonos.room}\n`);
    }
    const replyAudioPath = await writeReplyAudio(reply);
    if (replyAudioPath) {
      process.stdout.write(`Reply audio: ${replyAudioPath}\n`);
      await maybePlayAudio(replyAudioPath);
    }
  } catch (error) {
    process.stderr.write(`Voice turn failed: ${error instanceof Error ? error.message : String(error)}\n`);
  } finally {
    isProcessingTurn = false;
    process.stdout.write("\nReady for next wake trigger. Type q then Enter to quit.\n");
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

process.stdout.write("OpenClaw desktop voice client started.\n");
process.stdout.write("Press Enter for manual fallback recording, or type q then Enter to quit.\n");

if (ambientModeEnabled) {
  process.stdout.write(
    `Ambient mode enabled (interval: ${ambientIntervalMs}ms, autostart: ${ambientAutoStart ? "on" : "off"}).\n`
  );
}

const cleanupFns = [];

if (wakeMode !== "manual" && wakeMode !== "ambient") {
  try {
    const stopWakeWord = await startWakeWordDetector(runVoiceTurn);
    if (stopWakeWord) {
      cleanupFns.push(stopWakeWord);
      process.stdout.write(`Wake word listener active (${wakeProvider === "openwakeword" ? `OpenWakeWord: ${owwModel}` : "Porcupine"}).\n`);
    }
  } catch (error) {
    process.stderr.write(
      `Wake word setup unavailable: ${error instanceof Error ? error.message : String(error)}\n`
    );
    if (wakeMode === "wake-word") {
      process.stderr.write("Wake mode is strict wake-word. Exiting because setup failed.\n");
      rl.close();
      process.exitCode = 1;
      process.exit();
    }
  }
}

if (wakeMode !== "manual" && wakeMode !== "ambient") {
  try {
    const stopHotkey = await startGlobalHotkeyListener(runVoiceTurn);
    if (stopHotkey) {
      cleanupFns.push(stopHotkey);
      process.stdout.write(
        `Global hotkey listener active (${hotkeyModifiers.join("+")}${hotkeyModifiers.length ? "+" : ""}${hotkeyKey}).\n`
      );
    }
  } catch (error) {
    process.stderr.write(
      `Global hotkey setup unavailable: ${error instanceof Error ? error.message : String(error)}\n`
    );
    if (wakeMode === "hotkey") {
      process.stderr.write("Wake mode is strict hotkey. Exiting because setup failed.\n");
      rl.close();
      process.exitCode = 1;
      process.exit();
    }
  }
}

let ambientIntervalId = null;

function startAmbientLoop() {
  if (!ambientModeEnabled || !ambientAutoStart || ambientIntervalMs < 1000) {
    return;
  }
  if (ambientIntervalId) {
    return;
  }

  const tick = () => {
    runVoiceTurn("ambient-loop").catch((error) => {
      process.stderr.write(
        `Ambient loop turn failed: ${error instanceof Error ? error.message : String(error)}\n`
      );
    });
  };

  tick();
  ambientIntervalId = setInterval(tick, ambientIntervalMs);
  process.stdout.write("Ambient loop active.\n");
}

function stopAmbientLoop() {
  if (!ambientIntervalId) {
    return;
  }
  clearInterval(ambientIntervalId);
  ambientIntervalId = null;
}

startAmbientLoop();

for await (const line of rl) {
  const cmd = line.trim().toLowerCase();
  if (cmd === "q" || cmd === "quit" || cmd === "exit") {
    break;
  }

  await runVoiceTurn("manual-enter");
}

for (const cleanup of cleanupFns) {
  try {
    await cleanup();
  } catch {
    // ignored
  }
}

stopAmbientLoop();

rl.close();
