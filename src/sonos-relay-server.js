/**
 * sonos-relay-server.js
 *
 * VPS-side Sonos relay service for openclaw-voice.
 *
 * Accepts POST /play-audio from the voice server, decodes the base64
 * audio, serves it over a temporary HTTP URL that the Sonos speaker can
 * reach, and triggers UPnP playback via the Sonos AVTransport API.
 *
 * Required env vars:
 *   SONOS_RELAY_BEARER_TOKEN   - bearer token the voice server must present
 *   SONOS_IP                   - IP of the target Sonos speaker (e.g. 192.168.4.33)
 *   SONOS_RELAY_VPS_URL        - public base URL of this service that the Sonos
 *                                speaker can reach (e.g. http://10.x.x.x:8788)
 *
 * Optional env vars:
 *   SONOS_RELAY_PORT            - listening port (default 8788)
 *   SONOS_PORT                  - Sonos UPnP port (default 1400)
 *   SONOS_RELAY_CLIP_TTL_MS     - ms to keep the temp audio file (default 30000)
 *   SONOS_RELAY_RESTORE_POLL_INTERVAL_MS - restore poll cadence (default 500)
 *   SONOS_RELAY_RESTORE_TIMEOUT_MS       - max restore wait window (default 20000)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import dotenv from "dotenv";
import express from "express";

import { playClipWithRestore } from "./sonos-relay-lib.js";

dotenv.config();

const requiredEnv = ["SONOS_RELAY_BEARER_TOKEN", "SONOS_IP", "SONOS_RELAY_VPS_URL"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  throw new Error(`sonos-relay-server: missing required env vars: ${missingEnv.join(", ")}`);
}

const RELAY_PORT = Number(process.env.SONOS_RELAY_PORT || 8788);
const SONOS_IP = process.env.SONOS_IP;
const SONOS_PORT = Number(process.env.SONOS_PORT || 1400);
const VPS_BASE_URL = process.env.SONOS_RELAY_VPS_URL.replace(/\/$/, "");
const CLIP_TTL_MS = Number(process.env.SONOS_RELAY_CLIP_TTL_MS || 30000);
const RESTORE_POLL_INTERVAL_MS = Number(process.env.SONOS_RELAY_RESTORE_POLL_INTERVAL_MS || 500);
const RESTORE_POLL_TIMEOUT_MS = Number(process.env.SONOS_RELAY_RESTORE_TIMEOUT_MS || 20000);
const BEARER_TOKEN = process.env.SONOS_RELAY_BEARER_TOKEN;

// Temp directory for audio clips
const CLIP_DIR = path.join(os.tmpdir(), "sonos-relay-clips");
await fs.promises.mkdir(CLIP_DIR, { recursive: true });

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "20mb" }));

function requireBearer(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  if (header.slice("Bearer ".length).trim() !== BEARER_TOKEN) {
    res.status(401).json({ error: "Invalid bearer token" });
    return;
  }
  next();
}

/**
 * Serve a stored audio clip by filename.
 * No auth required — the URL is a random UUID path, and Sonos devices
 * cannot present bearer tokens.
 */
app.get("/clips/:filename", async (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(CLIP_DIR, filename);

  try {
    const stat = await fs.promises.stat(filePath);
    const ext = path.extname(filename).replace(".", "").toLowerCase();
    const mimeByExt = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      aac: "audio/aac",
      m4a: "audio/mp4"
    };
    const contentType = mimeByExt[ext] || "application/octet-stream";
    res.set("Content-Type", contentType);
    res.set("Content-Length", stat.size);
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.status(404).json({ error: "Clip not found or expired" });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    sonosIp: SONOS_IP,
    sonosPort: SONOS_PORT,
    vpsBaseUrl: VPS_BASE_URL
  });
});

/**
 * POST /play-audio
 *
 * Body: { room, text, audioBase64, audioMimeType }
 * Decodes audio, serves it as a temp clip URL, and plays it on Sonos.
 */
app.post("/play-audio", requireBearer, async (req, res) => {
  const { room, text, audioBase64, audioMimeType } = req.body || {};

  if (!audioBase64) {
    res.status(400).json({ error: "audioBase64 is required" });
    return;
  }
  if (!audioMimeType) {
    res.status(400).json({ error: "audioMimeType is required" });
    return;
  }

  let audioBuffer;
  try {
    audioBuffer = Buffer.from(audioBase64, "base64");
  } catch {
    res.status(400).json({ error: "audioBase64 is not valid base64" });
    return;
  }

  // Derive a file extension from the MIME type
  const extByMime = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/mp4": "m4a"
  };
  const ext = extByMime[audioMimeType.toLowerCase()] || "mp3";
  const clipId = crypto.randomUUID();
  const filename = `${clipId}.${ext}`;
  const filePath = path.join(CLIP_DIR, filename);
  const clipUrl = `${VPS_BASE_URL}/clips/${filename}`;

  try {
    await fs.promises.writeFile(filePath, audioBuffer);

    // Schedule cleanup after TTL
    setTimeout(() => {
      fs.promises.unlink(filePath).catch(() => {});
    }, CLIP_TTL_MS);

    const restore = await playClipWithRestore({
      sonosIp: SONOS_IP,
      sonosPort: SONOS_PORT,
      clipUrl,
      audioMimeType,
      pollIntervalMs: RESTORE_POLL_INTERVAL_MS,
      pollTimeoutMs: RESTORE_POLL_TIMEOUT_MS
    });

    res.json({
      ok: true,
      room: room || null,
      clipUrl,
      sonosIp: SONOS_IP,
      restore
    });
  } catch (error) {
    // Best-effort cleanup on failure
    fs.promises.unlink(filePath).catch(() => {});
    res.status(502).json({
      error: "Sonos relay failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.listen(RELAY_PORT, () => {
  process.stdout.write(
    `sonos-relay-server listening on :${RELAY_PORT} (Sonos: ${SONOS_IP}:${SONOS_PORT})\n`
  );
});
