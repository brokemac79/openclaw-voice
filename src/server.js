import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

import { createOpenClawClient, readOpenClawClientConfigFromEnv } from "./openclaw-client.js";

dotenv.config();

const requiredEnv = ["VOICE_API_BEARER_TOKEN", "OPENCLAW_URL"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  throw new Error(`Missing required env vars: ${missingEnv.join(", ")}`);
}

const port = Number(process.env.PORT || 8787);
const edgeVoice = process.env.EDGE_TTS_VOICE || "en-US-AndrewNeural";
const ttsProvider = (process.env.TTS_PROVIDER || "edge").trim().toLowerCase();
const piperBin = process.env.PIPER_BIN || "piper";
const piperModelPath = process.env.PIPER_MODEL_PATH || "";
const piperSpeakerId = process.env.PIPER_SPEAKER_ID || "";
const piperLengthScale = process.env.PIPER_LENGTH_SCALE || "";
const piperNoiseScale = process.env.PIPER_NOISE_SCALE || "";
const piperNoiseW = process.env.PIPER_NOISE_W || "";
const piperSentenceSilence = process.env.PIPER_SENTENCE_SILENCE || "";
const ttsFallbackProvider = (process.env.TTS_FALLBACK_PROVIDER || "piper").trim().toLowerCase();
const fasterWhisperModel = process.env.FASTER_WHISPER_MODEL || "base.en";
const fasterWhisperLanguage = process.env.FASTER_WHISPER_LANGUAGE || "en";
const fasterWhisperDevice = process.env.FASTER_WHISPER_DEVICE || "auto";
const fasterWhisperComputeType = process.env.FASTER_WHISPER_COMPUTE_TYPE || "int8";
const fasterWhisperPythonBin = process.env.FASTER_WHISPER_PYTHON_BIN || "python3";
const sonosRelayUrl = process.env.SONOS_RELAY_URL || process.env.SONOS_RELAY_PI_URL || "";
const sonosRelayFallbackUrl = process.env.SONOS_RELAY_FALLBACK_URL || "";
const sonosRelayAuthBearer = process.env.SONOS_RELAY_AUTH_BEARER || "";
const sonosRelayTimeoutMs = Number(process.env.SONOS_RELAY_TIMEOUT_MS || 12000);
const sonosRoomDefault = process.env.SONOS_ROOM_DEFAULT || "";

const execFileAsync = promisify(execFile);
const queryOpenClaw = createOpenClawClient(readOpenClawClientConfigFromEnv(process.env), {
  execFileAsync
});

const app = express();
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });

const AUDIO_MIME_BY_EXTENSION = {
  webm: "audio/webm",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
  mp3: "audio/mpeg"
};

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

app.use(express.static(publicDir));

function resolveAudioContentType(contentType, filename) {
  if (typeof contentType === "string" && contentType.toLowerCase().startsWith("audio/")) {
    return contentType;
  }

  const extension = path.extname(filename || "").replace(".", "").toLowerCase();
  if (extension && AUDIO_MIME_BY_EXTENSION[extension]) {
    return AUDIO_MIME_BY_EXTENSION[extension];
  }

  return "application/octet-stream";
}

function requireBearer(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (token !== process.env.VOICE_API_BEARER_TOKEN) {
    res.status(401).json({ error: "Invalid bearer token" });
    return;
  }

  next();
}

async function transcribeAudio(buffer, filename, contentType) {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "voice-"));
  const safeFilename = path.basename(filename || "recording.bin");
  const tmpPath = path.join(tmpDir, safeFilename);
  const whisperScriptPath = path.join(__dirname, "..", "scripts", "faster_whisper_transcribe.py");

  try {
    await fs.promises.writeFile(tmpPath, buffer);

    const args = [
      whisperScriptPath,
      "--audio-path",
      tmpPath,
      "--model",
      fasterWhisperModel,
      "--language",
      fasterWhisperLanguage,
      "--device",
      fasterWhisperDevice,
      "--compute-type",
      fasterWhisperComputeType,
      "--content-type",
      contentType || "application/octet-stream"
    ];

    const { stdout, stderr } = await execFileAsync(fasterWhisperPythonBin, args, {
      timeout: Number(process.env.FASTER_WHISPER_TIMEOUT_MS || 120000),
      maxBuffer: 8 * 1024 * 1024
    });

    if (stderr?.trim()) {
      process.stderr.write(`faster-whisper stderr: ${stderr}\n`);
    }

    const payload = JSON.parse(stdout);
    return (payload.text || "").trim();
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

async function sendAudioToSonosRelay(audioBuffer, text, roomName, audioMimeType = "audio/mpeg") {
  if (!sonosRelayUrl && !sonosRelayFallbackUrl) {
    return { routed: false };
  }

  const room = (roomName || sonosRoomDefault || "").trim();
  if (!room) {
    throw new Error("SONOS relay is configured but no room was provided");
  }

  const candidateRelays = [sonosRelayUrl, sonosRelayFallbackUrl].filter(Boolean);
  const relayErrors = [];

  for (const relayUrl of candidateRelays) {
    try {
      const relayResponse = await postToSonosRelay(relayUrl, {
        room,
        text,
        audioMimeType,
        audioBase64: audioBuffer.toString("base64")
      });

      return {
        routed: true,
        room,
        relayUrl,
        relay: relayResponse
      };
    } catch (error) {
      relayErrors.push(`${relayUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`All Sonos relays failed (${relayErrors.join(" | ")})`);
}

async function postToSonosRelay(relayUrl, body) {
  const headers = {
    "Content-Type": "application/json"
  };
  if (sonosRelayAuthBearer) {
    headers.Authorization = `Bearer ${sonosRelayAuthBearer}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sonosRelayTimeoutMs);

  let response;
  try {
    response = await fetch(relayUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`request failed (${response.status}): ${responseBody}`);
  }

  return response.json().catch(() => ({}));
}

function buildPiperArgs(outputPath) {
  const args = ["--model", piperModelPath, "--output_file", outputPath];

  if (piperSpeakerId) {
    args.push("--speaker", piperSpeakerId);
  }
  if (piperLengthScale) {
    args.push("--length_scale", piperLengthScale);
  }
  if (piperNoiseScale) {
    args.push("--noise_scale", piperNoiseScale);
  }
  if (piperNoiseW) {
    args.push("--noise_w", piperNoiseW);
  }
  if (piperSentenceSilence) {
    args.push("--sentence_silence", piperSentenceSilence);
  }

  return args;
}

async function synthesizeSpeechWithPiper(text) {
  if (!piperModelPath) {
    throw new Error("PIPER_MODEL_PATH is required when TTS provider is piper");
  }

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "voice-piper-"));
  const outPath = path.join(tmpDir, "reply.wav");

  try {
    const args = buildPiperArgs(outPath);
    await new Promise((resolve, reject) => {
      const child = spawn(piperBin, args, {
        stdio: ["pipe", "pipe", "pipe"]
      });

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Piper exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
          return;
        }
        resolve();
      });

      child.stdin.write(text.trim());
      child.stdin.end("\n");
    });

    const audio = await fs.promises.readFile(outPath);
    return {
      provider: "piper",
      audio,
      audioMimeType: "audio/wav"
    };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

async function synthesizeSpeechWithEdge(text) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const { audioStream } = await tts.toStream(text, {
    rate: process.env.EDGE_TTS_RATE || "+0%",
    volume: process.env.EDGE_TTS_VOLUME || "+0%",
    pitch: process.env.EDGE_TTS_PITCH || "+0Hz"
  });

  const chunks = [];
  await new Promise((resolve, reject) => {
    audioStream.on("data", (chunk) => chunks.push(chunk));
    audioStream.on("error", reject);
    audioStream.on("end", resolve);
  });

  return {
    provider: "edge",
    audio: Buffer.concat(chunks),
    audioMimeType: "audio/mpeg"
  };
}

async function synthesizeSpeech(text) {
  const preferred = ttsProvider;
  const fallback = ttsFallbackProvider;

  if (preferred === "piper") {
    return synthesizeSpeechWithPiper(text);
  }

  if (preferred === "edge") {
    if (fallback === "piper") {
      try {
        return await synthesizeSpeechWithEdge(text);
      } catch (error) {
        process.stderr.write(
          `Edge TTS failed, falling back to Piper: ${error instanceof Error ? error.message : String(error)}\n`
        );
        return synthesizeSpeechWithPiper(text);
      }
    }
    return synthesizeSpeechWithEdge(text);
  }

  if (preferred === "auto") {
    try {
      return await synthesizeSpeechWithEdge(text);
    } catch {
      return synthesizeSpeechWithPiper(text);
    }
  }

  throw new Error(`Unsupported TTS_PROVIDER value: ${preferred}`);
}

async function sendProactiveAlert(payload) {
  const room = (payload.room || sonosRoomDefault || "").trim();
  const title = String(payload.title || "").trim();
  const message = String(payload.message || payload.text || "").trim();
  const source = String(payload.source || "system").trim();

  if (!message) {
    throw new Error("Alert requires message or text");
  }
  if (!room) {
    throw new Error("Alert requires room (or SONOS_ROOM_DEFAULT)");
  }

  const spokenText = title ? `${title}. ${message}` : message;
  const synthesis = await synthesizeSpeech(spokenText);
  const sonos = await sendAudioToSonosRelay(synthesis.audio, spokenText, room, synthesis.audioMimeType);

  return {
    source,
    room,
    title,
    message,
    spokenText,
    ttsProvider: synthesis.provider,
    sonos
  };
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    ttsProvider,
    ttsFallbackProvider,
    sonosRelayConfigured: Boolean(sonosRelayUrl || sonosRelayFallbackUrl)
  });
});

app.get("/api/sonos/relay/health", requireBearer, async (_req, res) => {
  const candidateRelays = [sonosRelayUrl, sonosRelayFallbackUrl].filter(Boolean);
  if (candidateRelays.length === 0) {
    res.status(404).json({
      error: "No Sonos relay is configured"
    });
    return;
  }

  const probeResults = await Promise.all(
    candidateRelays.map(async (relayUrl) => {
      try {
        const headers = {};
        if (sonosRelayAuthBearer) {
          headers.Authorization = `Bearer ${sonosRelayAuthBearer}`;
        }

        const response = await fetch(relayUrl, {
          method: "HEAD",
          headers
        });
        return {
          relayUrl,
          ok: response.ok,
          status: response.status
        };
      } catch (error) {
        return {
          relayUrl,
          ok: false,
          status: null,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })
  );

  res.json({
    relays: probeResults
  });
});

app.post("/api/voice/alerts", requireBearer, async (req, res) => {
  try {
    const result = await sendProactiveAlert(req.body || {});
    res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    res.status(422).json({
      error: "Proactive alert failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/api/voice/turn", requireBearer, upload.single("audio"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      res.status(400).json({ error: "Missing audio upload" });
      return;
    }

    const uploadFilename = req.file.originalname || "recording.bin";
    const uploadMimeType = resolveAudioContentType(req.file.mimetype, uploadFilename);
    const transcribedText = await transcribeAudio(req.file.buffer, uploadFilename, uploadMimeType);

    if (!transcribedText) {
      res.status(422).json({ error: "Unable to transcribe audio" });
      return;
    }

    const openClawResponse = await queryOpenClaw(transcribedText, req.body?.sessionId);
    const spokenResponse = (openClawResponse || "").trim();

    if (!spokenResponse) {
      res.status(422).json({ error: "OpenClaw returned an empty response" });
      return;
    }

    const synthesis = await synthesizeSpeech(spokenResponse);
    const audioBase64 = synthesis.audio.toString("base64");
    const sonos = await sendAudioToSonosRelay(
      synthesis.audio,
      spokenResponse,
      req.body?.sonosRoom,
      synthesis.audioMimeType
    );

    res.json({
      transcription: transcribedText,
      responseText: spokenResponse,
      audioMimeType: synthesis.audioMimeType,
      ttsProvider: synthesis.provider,
      audioBase64,
      sonos
    });
  } catch (error) {
    res.status(500).json({
      error: "Voice pipeline failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  process.stdout.write(`openclaw-voice server listening on :${port}\n`);
});
