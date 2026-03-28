import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import dotenv from "dotenv";

dotenv.config();

const execAsync = promisify(exec);

const serviceUrl = (process.env.VOICE_CLIENT_SERVICE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const apiPath = process.env.VOICE_CLIENT_API_PATH || "/api/voice/turn";
const bearerToken = process.env.VOICE_CLIENT_BEARER_TOKEN || process.env.VOICE_API_BEARER_TOKEN || "";
const sessionId = process.env.VOICE_CLIENT_SESSION_ID || "Desktop";
const sonosRoom = process.env.VOICE_CLIENT_SONOS_ROOM || "";
const recorderCommandTemplate = process.env.VOICE_CLIENT_RECORD_COMMAND || "sox -q -d -c 1 -r 16000 \"{output}\" trim 0 5";
const playerCommandTemplate = process.env.VOICE_CLIENT_PLAY_COMMAND || "";
const outputDir = process.env.VOICE_CLIENT_OUTPUT_DIR || path.join(os.tmpdir(), "openclaw-voice-client");

if (!bearerToken) {
  throw new Error("Missing VOICE_CLIENT_BEARER_TOKEN (or VOICE_API_BEARER_TOKEN)");
}

await fs.promises.mkdir(outputDir, { recursive: true });

function toApiUrl() {
  return new URL(apiPath, `${serviceUrl}/`).toString();
}

function stamp() {
  return new Date().toISOString().replace(/[.:]/g, "-");
}

async function runTemplateCommand(template, outputPath) {
  const command = template.replace("{output}", outputPath);
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

process.stdout.write("OpenClaw desktop voice client started.\n");
process.stdout.write("Press Enter to capture a 5-second clip, or type q then Enter to quit.\n\n");

for await (const line of rl) {
  const cmd = line.trim().toLowerCase();
  if (cmd === "q" || cmd === "quit" || cmd === "exit") {
    break;
  }

  try {
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
  }

  process.stdout.write("\nPress Enter for next turn, or q to quit.\n");
}

rl.close();
