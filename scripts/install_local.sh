#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODEL_DIR="$ROOT_DIR/models/gemma-4-12b-qat"
MODEL_FILE="$MODEL_DIR/gemma-4-12b-it-qat-q4_0.gguf"
VENV_DIR="$ROOT_DIR/.venv"

cd "$ROOT_DIR"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required. Install it from https://brew.sh first."
  exit 1
fi

if ! command -v llama-server >/dev/null 2>&1; then
  brew install llama.cpp
fi

python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install -U pip "huggingface_hub[hf_xet]"

npm install

mkdir -p "$MODEL_DIR"
MODEL_DIR="$MODEL_DIR" "$VENV_DIR/bin/python" - <<'PY'
import os
from huggingface_hub import hf_hub_download

model_dir = os.environ["MODEL_DIR"]
hf_hub_download(
    repo_id="google/gemma-4-12B-it-qat-q4_0-gguf",
    filename="gemma-4-12b-it-qat-q4_0.gguf",
    local_dir=model_dir,
)
PY

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
fi

perl -0pi -e "s|^LLM_BASE_URL=.*$|LLM_BASE_URL=http://127.0.0.1:8080/v1|m; s|^LLM_MODEL=.*$|LLM_MODEL=gemma4-12b-qat|m; s|^PORT=.*$|PORT=3000|m" "$ROOT_DIR/.env"

echo "Installed. Model path: $MODEL_FILE"
echo "Start model: scripts/start_model.sh"
echo "Start web UI: scripts/start_webui.sh"
