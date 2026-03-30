#!/usr/bin/env python3
"""OpenWakeWord wake-word detector sidecar.

Streams microphone audio and writes a JSON line to stdout each time the
configured wake word is detected. Runs until terminated with SIGINT/SIGTERM.

Required packages:
    pip install openwakeword pyaudio numpy

Usage:
    python3 scripts/openwakeword_detect.py \\
        [--model hey_jarvis] \\
        [--threshold 0.5] \\
        [--inference-framework tflite]

Output (one JSON object per line when wake word is detected):
    {"detected": true, "model": "hey_jarvis", "score": 0.87}

Exit codes:
    0 - clean shutdown (SIGINT/SIGTERM)
    1 - fatal error (missing package, device error, bad args)
"""
import argparse
import json
import signal
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="OpenWakeWord wake-word detector")
    parser.add_argument("--model", default="hey_jarvis", help="Wake word model name or path")
    parser.add_argument("--threshold", type=float, default=0.5, help="Detection score threshold (0.0-1.0)")
    parser.add_argument(
        "--inference-framework",
        default="tflite",
        choices=["tflite", "onnx"],
        help="OpenWakeWord inference backend",
    )
    args = parser.parse_args()

    try:
        import numpy as np
        import pyaudio
        from openwakeword.model import Model
    except ImportError as exc:
        err = {
            "error": "openwakeword_missing_dependency",
            "details": (
                f"{exc}. Install with: pip install openwakeword pyaudio numpy"
            ),
        }
        sys.stderr.write(json.dumps(err) + "\n")
        return 1

    try:
        oww_model = Model(
            wakeword_models=[args.model],
            inference_framework=args.inference_framework,
        )
    except Exception as exc:
        err = {
            "error": "openwakeword_model_load_failed",
            "details": str(exc),
            "model": args.model,
        }
        sys.stderr.write(json.dumps(err) + "\n")
        return 1

    # PyAudio mic stream — 16 kHz mono int16, 80 ms chunks (1280 samples)
    FORMAT = pyaudio.paInt16
    CHANNELS = 1
    RATE = 16000
    CHUNK = 1280

    try:
        p = pyaudio.PyAudio()
        mic_stream = p.open(
            format=FORMAT,
            channels=CHANNELS,
            rate=RATE,
            input=True,
            frames_per_buffer=CHUNK,
        )
    except Exception as exc:
        err = {
            "error": "openwakeword_mic_open_failed",
            "details": str(exc),
        }
        sys.stderr.write(json.dumps(err) + "\n")
        return 1

    running = True

    def handle_signal(signum, frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        while running:
            try:
                raw = mic_stream.read(CHUNK, exception_on_overflow=False)
            except Exception:
                # Transient mic read error — keep trying
                continue

            audio = np.frombuffer(raw, dtype=np.int16)
            prediction = oww_model.predict(audio)

            for model_name, score in prediction.items():
                if score >= args.threshold:
                    result = {
                        "detected": True,
                        "model": model_name,
                        "score": round(float(score), 4),
                    }
                    sys.stdout.write(json.dumps(result) + "\n")
                    sys.stdout.flush()
    finally:
        try:
            mic_stream.stop_stream()
            mic_stream.close()
            p.terminate()
        except Exception:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
