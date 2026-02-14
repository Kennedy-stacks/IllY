#!/usr/bin/env python3
"""
Stream transcription from raw 16 kHz mono 16-bit PCM using Vosk.

Usage: python3 stt-vosk.py <model_path> <pcm_path>

Outputs lines like:
PARTIAL <text>
FINAL   <text>
"""

import sys
import json


def main():
    if len(sys.argv) != 3:
        sys.stderr.write("Usage: stt-vosk.py <model_path> <pcm_path>\n")
        sys.exit(1)

    model_path = sys.argv[1]
    pcm_path = sys.argv[2]

    from vosk import Model, KaldiRecognizer

    model = Model(model_path)
    rec = KaldiRecognizer(model, 16000)

    with open(pcm_path, "rb") as f:
        while True:
            data = f.read(4000)
            if not data:
                break

            if rec.AcceptWaveform(data):
                # Full utterance chunk recognized
                res = json.loads(rec.Result())
                text = (res.get("text") or "").strip()
                if text:
                    print(f"FINAL {text}", flush=True)
            else:
                # Partial hypothesis
                pres = json.loads(rec.PartialResult())
                ptxt = (pres.get("partial") or "").strip()
                if ptxt:
                    print(f"PARTIAL {ptxt}", flush=True)

    # Final flush
    fres = json.loads(rec.FinalResult())
    ftxt = (fres.get("text") or "").strip()
    if ftxt:
        print(f"FINAL {ftxt}", flush=True)


if __name__ == "__main__":
    main()
