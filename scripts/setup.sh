#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODEL_SIZE="${MODEL_SIZE:-e4b}"
INSTALL_OCR="${INSTALL_OCR:-1}"

cd "$ROOT_DIR"

echo "==> Local AI Helpdesk setup"
echo "    Model: $MODEL_SIZE"
echo "    OCR:   $INSTALL_OCR"

if [[ "$OSTYPE" == darwin* ]] && ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required on macOS. Install it first: https://brew.sh"
  exit 1
fi

if [[ "$OSTYPE" == darwin* ]]; then
  for tool in git cmake node python3; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      case "$tool" in
        python3) brew install python ;;
        *) brew install "$tool" ;;
      esac
    fi
  done
fi

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "==> Created .env from .env.example"
else
  echo "==> Keeping existing .env"
fi

if [[ "$MODEL_SIZE" == "12b" || "$MODEL_SIZE" == "12B" ]]; then
  LLM_MODEL_ALIAS="gemma4-12b-qat"
else
  LLM_MODEL_ALIAS="gemma4-e4b-qat"
fi

perl -0pi -e "s|^LLM_BASE_URL=.*$|LLM_BASE_URL=http://127.0.0.1:18080/v1|m; s|^LLM_MODEL=.*$|LLM_MODEL=$LLM_MODEL_ALIAS|m; s|^PORT=.*$|PORT=3000|m" "$ROOT_DIR/.env"

npm install
scripts/build_llama_cpp.sh
MODEL_SIZE="$MODEL_SIZE" scripts/download_model.sh

if [[ "$INSTALL_OCR" != "0" ]]; then
  scripts/install_typhoon_ocr.sh
else
  echo "==> Skipping OCR install. Later: INSTALL_OCR=1 scripts/setup.sh"
fi

npm run index:knowledge
npm run build

echo ""
echo "Setup complete."
echo "Run everything with:"
echo "  npm run local"
echo ""
echo "Open:"
echo "  http://127.0.0.1:3000"
