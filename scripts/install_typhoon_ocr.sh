#!/usr/bin/env zsh
set -euo pipefail

MODEL="${TYPHOON_OCR_MODEL:-scb10x/typhoon-ocr1.5-3b}"
OLLAMA_APP_BIN="/Applications/Ollama.app/Contents/Resources/ollama"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required. Install it from https://brew.sh first."
  exit 1
fi

if [[ "$OSTYPE" == darwin* ]]; then
  if [[ ! -x "$OLLAMA_APP_BIN" ]]; then
    brew install --cask ollama-app
  fi
  OLLAMA_BIN="$OLLAMA_APP_BIN"
else
  if ! command -v ollama >/dev/null 2>&1; then
    brew install ollama
  fi
  OLLAMA_BIN="$(command -v ollama)"
fi

if ! command -v pdfinfo >/dev/null 2>&1 || ! command -v pdftoppm >/dev/null 2>&1; then
  brew install poppler
fi

if ! curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  brew services stop ollama >/dev/null 2>&1 || true
  pkill -x ollama >/dev/null 2>&1 || true
  nohup "$OLLAMA_BIN" serve >/tmp/gemma-ollama.log 2>&1 &
  sleep 4
fi

"$OLLAMA_BIN" pull "$MODEL"

echo "Typhoon OCR is ready: $MODEL"
echo "Admin OCR endpoint expects Ollama at http://127.0.0.1:11434"
echo "If Ollama is not reachable after reboot, run: $OLLAMA_BIN serve"
