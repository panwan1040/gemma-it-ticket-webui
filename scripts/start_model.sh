#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_LLAMA_SERVER="$ROOT_DIR/vendor/llama.cpp/build/bin/llama-server"
LLAMA_SERVER="${LLAMA_SERVER:-$LOCAL_LLAMA_SERVER}"
MODEL="${MODEL:-$ROOT_DIR/models/gemma-4-12b-qat/gemma-4-12b-it-qat-q4_0.gguf}"
HOST="${HOST:-127.0.0.1}"
PORT="${LLM_PORT:-18080}"
CTX_SIZE="${CTX_SIZE:-16384}"
BATCH_SIZE="${BATCH_SIZE:-1024}"
UBATCH_SIZE="${UBATCH_SIZE:-256}"
THREADS="${THREADS:-4}"

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
  echo "Run scripts/install_local.sh first."
  exit 1
fi

exec "$LLAMA_SERVER" \
  --model "$MODEL" \
  --alias gemma4-12b-qat \
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
