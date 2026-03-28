const tokenInput = document.querySelector("#token");
const sessionIdInput = document.querySelector("#sessionId");
const recordButton = document.querySelector("#recordButton");
const statusEl = document.querySelector("#status");
const transcriptionEl = document.querySelector("#transcription");
const responseEl = document.querySelector("#response");
const player = document.querySelector("#player");

const mediaState = {
  stream: null,
  recorder: null,
  chunks: []
};

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function setReadyState() {
  const tokenPresent = tokenInput.value.trim().length > 0;
  recordButton.disabled = !mediaState.stream || !tokenPresent;
}

async function ensureMic() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("This browser does not support microphone capture.", true);
    return;
  }

  try {
    mediaState.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setStatus("Ready. Hold button to record.");
    setReadyState();
  } catch (error) {
    setStatus(`Microphone permission denied: ${error.message}`, true);
  }
}

async function postVoiceTurn(blob) {
  const token = tokenInput.value.trim();
  const sessionId = sessionIdInput.value.trim();

  if (!token) {
    setStatus("Missing API bearer token.", true);
    return;
  }

  setStatus("Uploading audio and waiting for response...");

  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  if (sessionId) {
    form.append("sessionId", sessionId);
  }

  const response = await fetch("/api/voice/turn", {
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
  await player.play();

  setStatus("Done. Ready for next turn.");
}

function startRecording() {
  if (!mediaState.stream) {
    return;
  }

  mediaState.chunks = [];
  mediaState.recorder = new MediaRecorder(mediaState.stream, { mimeType: "audio/webm" });

  mediaState.recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      mediaState.chunks.push(event.data);
    }
  });

  mediaState.recorder.addEventListener("stop", async () => {
    const blob = new Blob(mediaState.chunks, { type: "audio/webm" });
    try {
      await postVoiceTurn(blob);
    } catch (error) {
      setStatus(`Voice request failed: ${error.message}`, true);
    }
  });

  mediaState.recorder.start();
  setStatus("Recording... release to send");
}

function stopRecording() {
  if (mediaState.recorder && mediaState.recorder.state !== "inactive") {
    mediaState.recorder.stop();
  }
}

tokenInput.addEventListener("input", setReadyState);

recordButton.addEventListener("mousedown", startRecording);
recordButton.addEventListener("mouseup", stopRecording);
recordButton.addEventListener("mouseleave", stopRecording);
recordButton.addEventListener("touchstart", (event) => {
  event.preventDefault();
  startRecording();
});
recordButton.addEventListener("touchend", (event) => {
  event.preventDefault();
  stopRecording();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

ensureMic();
