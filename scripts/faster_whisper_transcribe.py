#!/usr/bin/env python3
import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper")
    parser.add_argument("--audio-path", required=True)
    parser.add_argument("--model", default="base.en")
    parser.add_argument("--language", default="en")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--content-type", default="application/octet-stream")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel

        model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
        segments, info = model.transcribe(args.audio_path, language=args.language)
        text = " ".join(segment.text.strip() for segment in segments if segment.text).strip()
        payload = {
            "text": text,
            "language": getattr(info, "language", args.language),
            "duration": getattr(info, "duration", None),
            "contentType": args.content_type,
        }
        sys.stdout.write(json.dumps(payload))
        return 0
    except Exception as exc:  # pragma: no cover
        err = {
            "error": "faster_whisper_failed",
            "details": str(exc),
        }
        sys.stderr.write(json.dumps(err))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
