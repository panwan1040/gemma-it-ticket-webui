#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_DIR="$ROOT_DIR/vendor"
LLAMA_DIR="$VENDOR_DIR/llama.cpp"

mkdir -p "$VENDOR_DIR"

if [[ ! -d "$LLAMA_DIR/.git" ]]; then
  git clone --depth 1 https://github.com/ggml-org/llama.cpp.git "$LLAMA_DIR"
else
  git -C "$LLAMA_DIR" pull --ff-only
fi

cmake -S "$LLAMA_DIR" -B "$LLAMA_DIR/build" -DGGML_METAL=ON -DCMAKE_BUILD_TYPE=Release
cmake --build "$LLAMA_DIR/build" --config Release -j "$(sysctl -n hw.ncpu)" --target llama-server llama-cli

echo "Built llama.cpp: $LLAMA_DIR/build/bin/llama-server"
