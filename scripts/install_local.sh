#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODEL_SIZE="${MODEL_SIZE:-e4b}"
VENV_DIR="$ROOT_DIR/.venv"

cd "$ROOT_DIR"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required. Install it from https://brew.sh first."
  exit 1
fi

python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install -U pip "huggingface_hub[hf_xet]"

npm install

scripts/build_llama_cpp.sh
MODEL_SIZE="$MODEL_SIZE" scripts/download_model.sh

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
fi

if [[ "$MODEL_SIZE" == "12b" || "$MODEL_SIZE" == "12B" ]]; then
  LLM_MODEL_ALIAS="gemma4-12b-qat"
else
  LLM_MODEL_ALIAS="gemma4-e4b-qat"
fi

perl -0pi -e "s|^LLM_BASE_URL=.*$|LLM_BASE_URL=http://127.0.0.1:18080/v1|m; s|^LLM_MODEL=.*$|LLM_MODEL=$LLM_MODEL_ALIAS|m; s|^PORT=.*$|PORT=3000|m" "$ROOT_DIR/.env"

echo "Installed local Gemma runtime for MODEL_SIZE=$MODEL_SIZE."
echo "Start model: scripts/start_model.sh"
echo "Start web UI: scripts/start_webui.sh"
