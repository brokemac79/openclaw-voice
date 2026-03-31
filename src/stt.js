import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPPORTED_PROVIDERS = [
  "faster-whisper",
  "browser",
  "openai-whisper",
  "google",
  "deepgram",
  "vosk",
  "azure"
];

export function readSttConfigFromEnv(env) {
  return {
    sttProvider: (env.STT_PROVIDER || "faster-whisper").trim().toLowerCase(),

    // faster-whisper
    fasterWhisperModel: env.FASTER_WHISPER_MODEL || "base.en",
    fasterWhisperLanguage: env.FASTER_WHISPER_LANGUAGE || "en",
    fasterWhisperDevice: env.FASTER_WHISPER_DEVICE || "auto",
    fasterWhisperComputeType: env.FASTER_WHISPER_COMPUTE_TYPE || "int8",
    fasterWhisperPythonBin: env.FASTER_WHISPER_PYTHON_BIN || "python3",
    fasterWhisperTimeoutMs: Number(env.FASTER_WHISPER_TIMEOUT_MS || 120000),

    // openai-whisper
    openaiApiKey: env.OPENAI_API_KEY || "",
    openaiWhisperModel: env.OPENAI_WHISPER_MODEL || "whisper-1",
    openaiWhisperLanguage: env.OPENAI_WHISPER_LANGUAGE || "en",
    openaiWhisperBaseUrl: env.OPENAI_WHISPER_BASE_URL || "https://api.openai.com",

    // google
    googleApiKey: env.GOOGLE_STT_API_KEY || "",
    googleLanguageCode: env.GOOGLE_STT_LANGUAGE_CODE || "en-US",
    googleModel: env.GOOGLE_STT_MODEL || "default",

    // deepgram
    deepgramApiKey: env.DEEPGRAM_API_KEY || "",
    deepgramModel: env.DEEPGRAM_MODEL || "nova-2",
    deepgramLanguage: env.DEEPGRAM_LANGUAGE || "en",

    // vosk
    voskModelPath: env.VOSK_MODEL_PATH || "",
    voskPythonBin: env.VOSK_PYTHON_BIN || "python3",
    voskTimeoutMs: Number(env.VOSK_TIMEOUT_MS || 120000),

    // azure
    azureSpeechKey: env.AZURE_SPEECH_KEY || "",
    azureSpeechRegion: env.AZURE_SPEECH_REGION || "",
    azureSpeechLanguage: env.AZURE_SPEECH_LANGUAGE || "en-US"
  };
}

async function withTempFile(buffer, filename, fn) {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "stt-"));
  const safeFilename = path.basename(filename || "recording.bin");
  const tmpPath = path.join(tmpDir, safeFilename);

  try {
    await fs.promises.writeFile(tmpPath, buffer);
    return await fn(tmpPath);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

function contentTypeToExtension(contentType) {
  const map = {
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
    "audio/flac": "flac"
  };
  const base = (contentType || "").split(";")[0].trim().toLowerCase();
  return map[base] || null;
}

async function transcribeFasterWhisper(buffer, filename, contentType, config) {
  const whisperScriptPath = path.join(__dirname, "..", "scripts", "faster_whisper_transcribe.py");

  return withTempFile(buffer, filename, async (tmpPath) => {
    const args = [
      whisperScriptPath,
      "--audio-path", tmpPath,
      "--model", config.fasterWhisperModel,
      "--language", config.fasterWhisperLanguage,
      "--device", config.fasterWhisperDevice,
      "--compute-type", config.fasterWhisperComputeType,
      "--content-type", contentType || "application/octet-stream"
    ];

    const { stdout, stderr } = await execFileAsync(config.fasterWhisperPythonBin, args, {
      timeout: config.fasterWhisperTimeoutMs,
      maxBuffer: 8 * 1024 * 1024
    });

    if (stderr?.trim()) {
      process.stderr.write(`faster-whisper stderr: ${stderr}\n`);
    }

    const payload = JSON.parse(stdout);
    return (payload.text || "").trim();
  });
}

function transcribeBrowser(_buffer, _filename, _contentType, _config) {
  throw new Error(
    "STT_PROVIDER=browser means speech recognition runs in the browser via Web Speech API. " +
    "The server should not receive audio for transcription. " +
    "Send transcribed text directly using the 'transcription' field in the request body."
  );
}

async function transcribeOpenaiWhisper(buffer, filename, contentType, config) {
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required when STT_PROVIDER=openai-whisper");
  }

  const ext = contentTypeToExtension(contentType) || path.extname(filename || "").replace(".", "") || "webm";
  const uploadFilename = `audio.${ext}`;

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: contentType || "application/octet-stream" }), uploadFilename);
  form.append("model", config.openaiWhisperModel);
  if (config.openaiWhisperLanguage) {
    form.append("language", config.openaiWhisperLanguage);
  }

  const response = await fetch(`${config.openaiWhisperBaseUrl}/v1/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`
    },
    body: form
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI Whisper API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  return (data.text || "").trim();
}

async function transcribeGoogle(buffer, _filename, contentType, config) {
  if (!config.googleApiKey) {
    throw new Error("GOOGLE_STT_API_KEY is required when STT_PROVIDER=google");
  }

  const audioContent = buffer.toString("base64");

  const encodingMap = {
    "audio/webm": "WEBM_OPUS",
    "audio/ogg": "OGG_OPUS",
    "audio/flac": "FLAC",
    "audio/wav": "LINEAR16",
    "audio/mpeg": "MP3",
    "audio/mp4": "MP3",
    "audio/aac": "MP3"
  };
  const base = (contentType || "").split(";")[0].trim().toLowerCase();
  const encoding = encodingMap[base] || "WEBM_OPUS";

  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:recognize?key=${config.googleApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          encoding,
          languageCode: config.googleLanguageCode,
          model: config.googleModel,
          enableAutomaticPunctuation: true
        },
        audio: { content: audioContent }
      })
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Google STT API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  const results = data.results || [];
  return results
    .map((r) => (r.alternatives?.[0]?.transcript || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function transcribeDeepgram(buffer, _filename, contentType, config) {
  if (!config.deepgramApiKey) {
    throw new Error("DEEPGRAM_API_KEY is required when STT_PROVIDER=deepgram");
  }

  const params = new URLSearchParams({
    model: config.deepgramModel,
    language: config.deepgramLanguage,
    punctuate: "true",
    smart_format: "true"
  });

  const response = await fetch(
    `https://api.deepgram.com/v1/listen?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${config.deepgramApiKey}`,
        "Content-Type": contentType || "application/octet-stream"
      },
      body: buffer
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Deepgram API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
  return transcript.trim();
}

async function transcribeVosk(buffer, filename, _contentType, config) {
  if (!config.voskModelPath) {
    throw new Error("VOSK_MODEL_PATH is required when STT_PROVIDER=vosk");
  }

  const voskScriptPath = path.join(__dirname, "..", "scripts", "vosk_transcribe.py");

  return withTempFile(buffer, filename, async (tmpPath) => {
    const args = [
      voskScriptPath,
      "--audio-path", tmpPath,
      "--model-path", config.voskModelPath
    ];

    const { stdout, stderr } = await execFileAsync(config.voskPythonBin, args, {
      timeout: config.voskTimeoutMs,
      maxBuffer: 8 * 1024 * 1024
    });

    if (stderr?.trim()) {
      process.stderr.write(`vosk stderr: ${stderr}\n`);
    }

    const payload = JSON.parse(stdout);
    return (payload.text || "").trim();
  });
}

async function transcribeAzure(buffer, _filename, contentType, config) {
  if (!config.azureSpeechKey) {
    throw new Error("AZURE_SPEECH_KEY is required when STT_PROVIDER=azure");
  }
  if (!config.azureSpeechRegion) {
    throw new Error("AZURE_SPEECH_REGION is required when STT_PROVIDER=azure");
  }

  const audioContentType = contentType || "audio/wav";

  const response = await fetch(
    `https://${config.azureSpeechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${config.azureSpeechLanguage}&format=detailed`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": config.azureSpeechKey,
        "Content-Type": audioContentType,
        Accept: "application/json"
      },
      body: buffer
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Azure STT API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  return (data.DisplayText || data.NBest?.[0]?.Display || "").trim();
}

const PROVIDER_MAP = {
  "faster-whisper": transcribeFasterWhisper,
  browser: transcribeBrowser,
  "openai-whisper": transcribeOpenaiWhisper,
  google: transcribeGoogle,
  deepgram: transcribeDeepgram,
  vosk: transcribeVosk,
  azure: transcribeAzure
};

export function createTranscriber(config) {
  const provider = config.sttProvider;

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(
      `Unsupported STT_PROVIDER value: "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(", ")}`
    );
  }

  const transcribeFn = PROVIDER_MAP[provider];

  return async function transcribeAudio(buffer, filename, contentType) {
    return transcribeFn(buffer, filename, contentType, config);
  };
}
