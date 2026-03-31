#!/usr/bin/env python3
"""Transcribe audio with Vosk (lightweight offline STT).

Requires: pip install vosk soundfile
Download models from https://alphacephei.com/vosk/models
"""
import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe audio with Vosk")
    parser.add_argument("--audio-path", required=True)
    parser.add_argument("--model-path", required=True, help="Path to Vosk model directory")
    args = parser.parse_args()

    try:
        import soundfile as sf
        from vosk import KaldiRecognizer, Model

        model = Model(args.model_path)

        data, samplerate = sf.read(args.audio_path, dtype="int16")
        if len(data.shape) > 1:
            data = data[:, 0]

        rec = KaldiRecognizer(model, samplerate)
        rec.SetWords(False)

        chunk_size = 4000
        for i in range(0, len(data), chunk_size):
            chunk = data[i : i + chunk_size]
            rec.AcceptWaveform(chunk.tobytes())

        result = json.loads(rec.FinalResult())
        text = result.get("text", "").strip()

        payload = {"text": text}
        sys.stdout.write(json.dumps(payload))
        return 0
    except Exception as exc:
        err = {
            "error": "vosk_failed",
            "details": str(exc),
        }
        sys.stderr.write(json.dumps(err))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
