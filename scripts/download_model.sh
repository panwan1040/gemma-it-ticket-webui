#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
MODEL_SIZE="${MODEL_SIZE:-e4b}"

case "$MODEL_SIZE" in
  e4b|E4B)
    REPO="google/gemma-4-E4B-it-qat-q4_0-gguf"
    FILE="gemma-4-E4B_q4_0-it.gguf"
    MODEL_DIR="$ROOT_DIR/models/gemma-4-e4b-qat"
    ;;
  12b|12B)
    REPO="google/gemma-4-12B-it-qat-q4_0-gguf"
    FILE="gemma-4-12b-it-qat-q4_0.gguf"
    MODEL_DIR="$ROOT_DIR/models/gemma-4-12b-qat"
    ;;
  *)
    echo "Unknown MODEL_SIZE: $MODEL_SIZE. Use e4b or 12b."
    exit 1
    ;;
esac

python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install -U pip "huggingface_hub[hf_xet]"
mkdir -p "$MODEL_DIR"

MODEL_DIR="$MODEL_DIR" REPO="$REPO" FILE="$FILE" "$VENV_DIR/bin/python" - <<'PY'
import os
from huggingface_hub import hf_hub_download

hf_hub_download(
    repo_id=os.environ["REPO"],
    filename=os.environ["FILE"],
    local_dir=os.environ["MODEL_DIR"],
)
PY

echo "Downloaded $MODEL_SIZE model: $MODEL_DIR/$FILE"
