import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readSttConfigFromEnv, createTranscriber } from "../src/stt.js";

describe("readSttConfigFromEnv", () => {
  it("returns faster-whisper as default provider", () => {
    const config = readSttConfigFromEnv({});
    assert.equal(config.sttProvider, "faster-whisper");
  });

  it("reads STT_PROVIDER from env", () => {
    const config = readSttConfigFromEnv({ STT_PROVIDER: "deepgram" });
    assert.equal(config.sttProvider, "deepgram");
  });

  it("normalizes provider to lowercase and trimmed", () => {
    const config = readSttConfigFromEnv({ STT_PROVIDER: "  OpenAI-Whisper  " });
    assert.equal(config.sttProvider, "openai-whisper");
  });

  it("reads faster-whisper config", () => {
    const config = readSttConfigFromEnv({
      FASTER_WHISPER_MODEL: "large-v2",
      FASTER_WHISPER_LANGUAGE: "fr",
      FASTER_WHISPER_DEVICE: "cuda",
      FASTER_WHISPER_COMPUTE_TYPE: "float16",
      FASTER_WHISPER_PYTHON_BIN: "/usr/bin/python3.11",
      FASTER_WHISPER_TIMEOUT_MS: "60000"
    });
    assert.equal(config.fasterWhisperModel, "large-v2");
    assert.equal(config.fasterWhisperLanguage, "fr");
    assert.equal(config.fasterWhisperDevice, "cuda");
    assert.equal(config.fasterWhisperComputeType, "float16");
    assert.equal(config.fasterWhisperPythonBin, "/usr/bin/python3.11");
    assert.equal(config.fasterWhisperTimeoutMs, 60000);
  });

  it("reads openai-whisper config", () => {
    const config = readSttConfigFromEnv({
      OPENAI_API_KEY: "sk-test",
      OPENAI_WHISPER_MODEL: "whisper-1",
      OPENAI_WHISPER_LANGUAGE: "es"
    });
    assert.equal(config.openaiApiKey, "sk-test");
    assert.equal(config.openaiWhisperModel, "whisper-1");
    assert.equal(config.openaiWhisperLanguage, "es");
  });

  it("reads google config", () => {
    const config = readSttConfigFromEnv({
      GOOGLE_STT_API_KEY: "gkey",
      GOOGLE_STT_LANGUAGE_CODE: "de-DE",
      GOOGLE_STT_MODEL: "command_and_search"
    });
    assert.equal(config.googleApiKey, "gkey");
    assert.equal(config.googleLanguageCode, "de-DE");
    assert.equal(config.googleModel, "command_and_search");
  });

  it("reads deepgram config", () => {
    const config = readSttConfigFromEnv({
      DEEPGRAM_API_KEY: "dg-key",
      DEEPGRAM_MODEL: "nova-2-general",
      DEEPGRAM_LANGUAGE: "fr"
    });
    assert.equal(config.deepgramApiKey, "dg-key");
    assert.equal(config.deepgramModel, "nova-2-general");
    assert.equal(config.deepgramLanguage, "fr");
  });

  it("reads vosk config", () => {
    const config = readSttConfigFromEnv({
      VOSK_MODEL_PATH: "/models/vosk-en",
      VOSK_PYTHON_BIN: "python3.10",
      VOSK_TIMEOUT_MS: "30000"
    });
    assert.equal(config.voskModelPath, "/models/vosk-en");
    assert.equal(config.voskPythonBin, "python3.10");
    assert.equal(config.voskTimeoutMs, 30000);
  });

  it("reads azure config", () => {
    const config = readSttConfigFromEnv({
      AZURE_SPEECH_KEY: "az-key",
      AZURE_SPEECH_REGION: "eastus",
      AZURE_SPEECH_LANGUAGE: "ja-JP"
    });
    assert.equal(config.azureSpeechKey, "az-key");
    assert.equal(config.azureSpeechRegion, "eastus");
    assert.equal(config.azureSpeechLanguage, "ja-JP");
  });
});

describe("createTranscriber", () => {
  it("throws for unsupported provider", () => {
    assert.throws(
      () => createTranscriber({ sttProvider: "unknown" }),
      /Unsupported STT_PROVIDER value: "unknown"/
    );
  });

  it("returns a function for each supported provider", () => {
    const providers = [
      "faster-whisper", "browser", "openai-whisper",
      "google", "deepgram", "vosk", "azure"
    ];
    for (const provider of providers) {
      const fn = createTranscriber({ sttProvider: provider });
      assert.equal(typeof fn, "function", `Expected function for ${provider}`);
    }
  });

  it("browser provider throws with guidance message", async () => {
    const transcribe = createTranscriber({ sttProvider: "browser" });
    await assert.rejects(
      () => transcribe(Buffer.from("audio"), "test.webm", "audio/webm"),
      /Web Speech API/
    );
  });

  it("openai-whisper requires OPENAI_API_KEY", async () => {
    const transcribe = createTranscriber({
      sttProvider: "openai-whisper",
      openaiApiKey: ""
    });
    await assert.rejects(
      () => transcribe(Buffer.from("audio"), "test.webm", "audio/webm"),
      /OPENAI_API_KEY is required/
    );
  });

  it("google requires GOOGLE_STT_API_KEY", async () => {
    const transcribe = createTranscriber({
      sttProvider: "google",
      googleApiKey: ""
    });
    await assert.rejects(
      () => transcribe(Buffer.from("audio"), "test.webm", "audio/webm"),
      /GOOGLE_STT_API_KEY is required/
    );
  });

  it("deepgram requires DEEPGRAM_API_KEY", async () => {
    const transcribe = createTranscriber({
      sttProvider: "deepgram",
      deepgramApiKey: ""
    });
    await assert.rejects(
      () => transcribe(Buffer.from("audio"), "test.webm", "audio/webm"),
      /DEEPGRAM_API_KEY is required/
    );
  });

  it("vosk requires VOSK_MODEL_PATH", async () => {
    const transcribe = createTranscriber({
      sttProvider: "vosk",
      voskModelPath: ""
    });
    await assert.rejects(
      () => transcribe(Buffer.from("audio"), "test.webm", "audio/webm"),
      /VOSK_MODEL_PATH is required/
    );
  });

  it("azure requires AZURE_SPEECH_KEY", async () => {
    const transcribe = createTranscriber({
      sttProvider: "azure",
      azureSpeechKey: "",
      azureSpeechRegion: "eastus"
    });
    await assert.rejects(
      () => transcribe(Buffer.from("audio"), "test.webm", "audio/webm"),
      /AZURE_SPEECH_KEY is required/
    );
  });

  it("azure requires AZURE_SPEECH_REGION", async () => {
    const transcribe = createTranscriber({
      sttProvider: "azure",
      azureSpeechKey: "key",
      azureSpeechRegion: ""
    });
    await assert.rejects(
      () => transcribe(Buffer.from("audio"), "test.webm", "audio/webm"),
      /AZURE_SPEECH_REGION is required/
    );
  });
});
