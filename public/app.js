const STORAGE_KEY = "openclawVoiceSettingsV1";

const serviceUrlInput = document.querySelector("#serviceUrl");
const tokenInput = document.querySelector("#token");
const sessionIdInput = document.querySelector("#sessionId");
const sonosRoomInput = document.querySelector("#sonosRoom");
const apiPathInput = document.querySelector("#apiPath");
const saveSettingsButton = document.querySelector("#saveSettings");
const clearSettingsButton = document.querySelector("#clearSettings");
const settingsSummaryEl = document.querySelector("#settingsSummary");
const recordButton = document.querySelector("#recordButton");
const statusEl = document.querySelector("#status");
const transcriptionEl = document.querySelector("#transcription");
const responseEl = document.querySelector("#response");
const player = document.querySelector("#player");

const settings = {
  serviceUrl: window.location.origin,
  token: "",
  sessionId: "",
  sonosRoom: "",
  apiPath: "/api/voice/turn"
};

const mediaState = {
  stream: null,
  recorder: null,
  chunks: [],
  isRecording: false
};

const RECORDER_FORMATS = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/mp4;codecs=mp4a.40.2", extension: "m4a" },
  { mimeType: "audio/mp4", extension: "m4a" },
  { mimeType: "audio/aac", extension: "aac" }
];

function fallbackFormat() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isSafari = userAgent.includes("safari") && !userAgent.includes("chrome") && !userAgent.includes("android");
  return isSafari ? { mimeType: "", extension: "m4a" } : { mimeType: "", extension: "webm" };
}

function setStatus(message, state = "default") {
  statusEl.textContent = message;
  statusEl.classList.remove("error", "ok");
  if (state === "error") {
    statusEl.classList.add("error");
  }
  if (state === "ok") {
    statusEl.classList.add("ok");
  }
}

function setReadyState() {
  const tokenPresent = settings.token.length > 0;
  recordButton.disabled = !mediaState.stream || !tokenPresent;
}

function normalizeApiPath(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "/api/voice/turn";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function isLocalHttpUrl(parsedUrl) {
  return parsedUrl.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsedUrl.hostname);
}

function updateInputsFromSettings() {
  serviceUrlInput.value = settings.serviceUrl;
  tokenInput.value = settings.token;
  sessionIdInput.value = settings.sessionId;
  sonosRoomInput.value = settings.sonosRoom;
  apiPathInput.value = settings.apiPath;
}

function updateSettingsSummary() {
  const maskedToken = settings.token ? `${"*".repeat(Math.min(settings.token.length, 8))}` : "not set";
  const sessionId = settings.sessionId || "not set";
  const room = settings.sonosRoom || "not set";
  settingsSummaryEl.textContent = `Server: ${settings.serviceUrl} | Token: ${maskedToken} | Session: ${sessionId} | Room: ${room}`;
}

function saveSettings() {
  const next = {
    serviceUrl: serviceUrlInput.value.trim() || window.location.origin,
    token: tokenInput.value.trim(),
    sessionId: sessionIdInput.value.trim(),
    sonosRoom: sonosRoomInput.value.trim(),
    apiPath: normalizeApiPath(apiPathInput.value)
  };

  let parsedUrl;
  try {
    parsedUrl = new URL(next.serviceUrl);
  } catch {
    setStatus("Please enter a valid service URL (example: https://voice.example.com).", "error");
    return;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    setStatus("Service URL must start with https:// (or http://localhost / http://127.0.0.1 for local development).", "error");
    return;
  }

  if (parsedUrl.protocol === "http:" && !isLocalHttpUrl(parsedUrl)) {
    setStatus("Service URL must use https:// for non-local hosts. Use http://localhost or http://127.0.0.1 only for local development.", "error");
    return;
  }

  Object.assign(settings, {
    serviceUrl: parsedUrl.origin,
    token: next.token,
    sessionId: next.sessionId,
    sonosRoom: next.sonosRoom,
    apiPath: next.apiPath
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  updateInputsFromSettings();
  updateSettingsSummary();
  setReadyState();

  if (!settings.token) {
    setStatus("Settings saved. Add your access token to enable recording.");
    return;
  }

  setStatus("Settings saved. You can now hold the button to talk.", "ok");
}

function clearSettings() {
  localStorage.removeItem(STORAGE_KEY);
  Object.assign(settings, {
    serviceUrl: window.location.origin,
    token: "",
    sessionId: "",
    sonosRoom: "",
    apiPath: "/api/voice/turn"
  });
  updateInputsFromSettings();
  updateSettingsSummary();
  setReadyState();
  setStatus("Saved settings cleared. Enter your details and press Save Settings.");
}

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    updateInputsFromSettings();
    updateSettingsSummary();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const hasSonosRoom = typeof parsed.sonosRoom === "string";
    const legacyRoom = !hasSonosRoom && typeof parsed.sessionId === "string" ? parsed.sessionId : "";
    Object.assign(settings, {
      serviceUrl: typeof parsed.serviceUrl === "string" ? parsed.serviceUrl : window.location.origin,
      token: typeof parsed.token === "string" ? parsed.token : "",
      sessionId: hasSonosRoom && typeof parsed.sessionId === "string" ? parsed.sessionId : "",
      sonosRoom: hasSonosRoom ? parsed.sonosRoom : legacyRoom,
      apiPath: typeof parsed.apiPath === "string" ? normalizeApiPath(parsed.apiPath) : "/api/voice/turn"
    });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  updateInputsFromSettings();
  updateSettingsSummary();
}

function getVoiceTurnEndpoint() {
  return new URL(settings.apiPath, settings.serviceUrl).toString();
}

async function ensureMic() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("This browser does not support microphone access.", "error");
    return;
  }

  if (!window.MediaRecorder) {
    setStatus("This browser does not support recording audio.", "error");
    return;
  }

  try {
    mediaState.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (settings.token) {
      setStatus("Microphone ready. Hold the button to record.", "ok");
    } else {
      setStatus("Microphone ready. Save your settings with a token to continue.");
    }
    setReadyState();
  } catch (error) {
    setStatus(`Microphone permission denied: ${error.message}`, "error");
  }
}

function pickRecordingFormat() {
  if (!window.MediaRecorder?.isTypeSupported) {
    return fallbackFormat();
  }

  const supported = RECORDER_FORMATS.find((format) => window.MediaRecorder.isTypeSupported(format.mimeType));
  if (supported) {
    return supported;
  }

  return fallbackFormat();
}

function extensionFromMimeType(mimeType, fallbackExtension) {
  if (!mimeType) {
    return fallbackExtension;
  }

  if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
    return "m4a";
  }
  if (mimeType.includes("aac")) {
    return "aac";
  }
  if (mimeType.includes("ogg")) {
    return "ogg";
  }
  if (mimeType.includes("webm")) {
    return "webm";
  }

  return fallbackExtension;
}

async function postVoiceTurn(blob, filename) {
  const token = settings.token;
  const sessionId = settings.sessionId;
  const sonosRoom = settings.sonosRoom;

  if (!token) {
    setStatus("Please save an access token before recording.", "error");
    return;
  }

  setStatus("Sending your audio. Waiting for assistant reply...");

  const form = new FormData();
  form.append("audio", blob, filename);
  if (sessionId) {
    form.append("sessionId", sessionId);
  }
  if (sonosRoom) {
    form.append("sonosRoom", sonosRoom);
  }

  const response = await fetch(getVoiceTurnEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const reason = body.details || body.error || response.statusText;
    throw new Error(reason);
  }

  const data = await response.json();
  transcriptionEl.textContent = data.transcription || "(empty)";
  responseEl.textContent = data.responseText || "(empty)";

  const src = `data:${data.audioMimeType};base64,${data.audioBase64}`;
  player.src = src;
  try {
    await player.play();
  } catch {
    setStatus("Reply received. Tap play on the audio controls to hear it.");
    return;
  }

  setStatus("Reply ready. You can ask another question.", "ok");
}

function startRecording() {
  if (!mediaState.stream || mediaState.isRecording || recordButton.disabled) {
    return;
  }

  const format = pickRecordingFormat();
  const recorderOptions = format.mimeType ? { mimeType: format.mimeType } : undefined;

  mediaState.chunks = [];
  mediaState.isRecording = true;
  mediaState.recorder = recorderOptions
    ? new MediaRecorder(mediaState.stream, recorderOptions)
    : new MediaRecorder(mediaState.stream);

  mediaState.recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      mediaState.chunks.push(event.data);
    }
  });

  mediaState.recorder.addEventListener("stop", async () => {
    mediaState.isRecording = false;
    recordButton.classList.remove("is-recording");

    const recordedMimeType = mediaState.recorder.mimeType || format.mimeType || "application/octet-stream";
    const blob = new Blob(mediaState.chunks, { type: recordedMimeType });
    const fileExtension = extensionFromMimeType(recordedMimeType, format.extension);
    try {
      await postVoiceTurn(blob, `recording.${fileExtension}`);
    } catch (error) {
      setStatus(`Request failed: ${error.message}. Check URL/token and try again.`, "error");
    }
  });

  mediaState.recorder.start();
  recordButton.classList.add("is-recording");
  setStatus("Recording now... release the button to send audio.");
}

function stopRecording() {
  if (!mediaState.isRecording) {
    return;
  }

  if (mediaState.recorder && mediaState.recorder.state !== "inactive") {
    mediaState.recorder.stop();
  }
}

recordButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  recordButton.setPointerCapture(event.pointerId);
  startRecording();
});
recordButton.addEventListener("pointerup", (event) => {
  event.preventDefault();
  stopRecording();
});
recordButton.addEventListener("pointercancel", (event) => {
  event.preventDefault();
  stopRecording();
});
recordButton.addEventListener("pointerleave", (event) => {
  event.preventDefault();
  stopRecording();
});

recordButton.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    startRecording();
  }
});

recordButton.addEventListener("keyup", (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    stopRecording();
  }
});

saveSettingsButton.addEventListener("click", saveSettings);
clearSettingsButton.addEventListener("click", clearSettings);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

loadSettings();
setReadyState();
ensureMic();
