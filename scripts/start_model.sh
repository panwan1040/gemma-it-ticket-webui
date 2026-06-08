#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_LLAMA_SERVER="$ROOT_DIR/vendor/llama.cpp/build/bin/llama-server"
LLAMA_SERVER="${LLAMA_SERVER:-$LOCAL_LLAMA_SERVER}"
MODEL_SIZE="${MODEL_SIZE:-e4b}"
HOST="${HOST:-0.0.0.0}"
PORT="${LLM_PORT:-18080}"
CTX_SIZE="${CTX_SIZE:-8192}"
BATCH_SIZE="${BATCH_SIZE:-1024}"
UBATCH_SIZE="${UBATCH_SIZE:-256}"
THREADS="${THREADS:-4}"

case "$MODEL_SIZE" in
  e4b|E4B)
    MODEL="${MODEL:-$ROOT_DIR/models/gemma-4-e4b-qat/gemma-4-E4B_q4_0-it.gguf}"
    ALIAS="gemma4-e4b-qat"
    ;;
  12b|12B)
    MODEL="${MODEL:-$ROOT_DIR/models/gemma-4-12b-qat/gemma-4-12b-it-qat-q4_0.gguf}"
    ALIAS="gemma4-12b-qat"
    CTX_SIZE="${CTX_SIZE:-16384}"
    ;;
  *)
    echo "Unknown MODEL_SIZE: $MODEL_SIZE. Use e4b or 12b."
    exit 1
    ;;
esac

if [[ ! -x "$LLAMA_SERVER" ]]; then
  if command -v llama-server >/dev/null 2>&1; then
    LLAMA_SERVER="$(command -v llama-server)"
  else
    echo "llama-server not found. Run scripts/build_llama_cpp.sh first."
    exit 1
  fi
fi

if [[ ! -f "$MODEL" ]]; then
  echo "Model file not found: $MODEL"
  echo "Run MODEL_SIZE=$MODEL_SIZE scripts/download_model.sh first."
  exit 1
fi

exec "$LLAMA_SERVER" \
  --model "$MODEL" \
  --alias "$ALIAS" \
  --host "$HOST" \
  --port "$PORT" \
  --ctx-size "$CTX_SIZE" \
  --batch-size "$BATCH_SIZE" \
  --ubatch-size "$UBATCH_SIZE" \
  --n-gpu-layers 99 \
  --flash-attn on \
  --reasoning off \
  --cache-type-k q8_0 \
  --cache-type-v q8_0 \
  --parallel 1 \
  --threads "$THREADS"
