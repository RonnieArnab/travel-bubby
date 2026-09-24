#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PYTHON_BIN="${MEDIA_SETUP_PYTHON:-python3}"
"$PYTHON_BIN" -m venv .venv
.venv/bin/python -m pip install -r workers/requirements.txt
.venv/bin/python - <<'PY'
import os
from pathlib import Path
from faster_whisper import WhisperModel
cache = os.environ.get("WHISPER_CACHE_DIR", str(Path.cwd() / "data" / "whisper"))
WhisperModel(os.environ.get("WHISPER_MODEL", "small"), device="cpu", compute_type="int8", download_root=cache)
print("Local speech model ready.")
PY
for tool in ffmpeg tesseract ollama; do
  if ! command -v "$tool" >/dev/null; then
    printf 'Missing tool: %s. See VIDEO_IMPORT.md for installation.\n' "$tool"
  fi
done
printf 'Next: npm run ai:serve, then in another terminal: ollama pull qwen3:4b\n'
