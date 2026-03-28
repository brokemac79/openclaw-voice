import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

dotenv.config();

const requiredEnv = ["OPENAI_API_KEY", "VOICE_API_BEARER_TOKEN", "OPENCLAW_URL"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  throw new Error(`Missing required env vars: ${missingEnv.join(", ")}`);
}

const port = Number(process.env.PORT || 8787);
const openClawMethod = (process.env.OPENCLAW_METHOD || "POST").toUpperCase();
const openClawInputField = process.env.OPENCLAW_INPUT_FIELD || "input";
const openClawOutputField = process.env.OPENCLAW_OUTPUT_FIELD || "response";
const edgeVoice = process.env.EDGE_TTS_VOICE || "en-US-AndrewNeural";

const app = express();
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

app.use(express.static(publicDir));

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
  const tmpPath = path.join(tmpDir, filename || "recording.webm");

  try {
    await fs.promises.writeFile(tmpPath, buffer);

    const form = new FormData();
    form.append("model", process.env.OPENAI_WHISPER_MODEL || "whisper-1");
    form.append("file", new Blob([buffer], { type: contentType }), path.basename(tmpPath));

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Whisper request failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    return data.text?.trim() || "";
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

async function queryOpenClaw(text, sessionId) {
  const payload = {
    [openClawInputField]: text,
    sessionId: sessionId || undefined
  };

  const headers = {
    "Content-Type": "application/json"
  };

  if (process.env.OPENCLAW_AUTH_BEARER) {
    headers.Authorization = `Bearer ${process.env.OPENCLAW_AUTH_BEARER}`;
  }

  const response = await fetch(process.env.OPENCLAW_URL, {
    method: openClawMethod,
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenClaw request failed (${response.status}): ${body}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await response.json();
    if (typeof json[openClawOutputField] === "string") {
      return json[openClawOutputField];
    }
    if (typeof json.text === "string") {
      return json.text;
    }
    return JSON.stringify(json);
  }

  return response.text();
}

async function synthesizeSpeech(text) {
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

  return Buffer.concat(chunks);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/voice/turn", requireBearer, upload.single("audio"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      res.status(400).json({ error: "Missing audio upload" });
      return;
    }

    const transcribedText = await transcribeAudio(
      req.file.buffer,
      req.file.originalname || "recording.webm",
      req.file.mimetype || "audio/webm"
    );

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

    const audio = await synthesizeSpeech(spokenResponse);
    const audioBase64 = audio.toString("base64");

    res.json({
      transcription: transcribedText,
      responseText: spokenResponse,
      audioMimeType: "audio/mpeg",
      audioBase64
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
