#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

MODEL_SIZE="${MODEL_SIZE:-e4b}"
LLM_PORT="${LLM_PORT:-18080}"
WEB_PORT="${PORT:-3000}"
START_OCR="${START_OCR:-1}"
CHILD_PIDS=()

cleanup() {
  for pid in "${CHILD_PIDS[@]}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
}
trap cleanup INT TERM EXIT

port_open() {
  nc -z 127.0.0.1 "$1" >/dev/null 2>&1
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-90}"
  for _ in {1..$attempts}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "==> $label is ready"
      return 0
    fi
    sleep 1
  done
  echo "Warning: $label did not become ready in time: $url"
  return 1
}

start_ocr() {
  if [[ "$START_OCR" == "0" ]]; then
    echo "==> OCR disabled for this run"
    return 0
  fi

  if curl -fsS "${TYPHOON_OCR_BASE_URL:-http://127.0.0.1:11434}/api/tags" >/dev/null 2>&1; then
    echo "==> OCR worker already running"
    return 0
  fi

  local ollama_bin="${OLLAMA_BIN:-}"
  if [[ -z "$ollama_bin" && -x "/Applications/Ollama.app/Contents/Resources/ollama" ]]; then
    ollama_bin="/Applications/Ollama.app/Contents/Resources/ollama"
  fi
  if [[ -z "$ollama_bin" ]] && command -v ollama >/dev/null 2>&1; then
    ollama_bin="$(command -v ollama)"
  fi

  if [[ -z "$ollama_bin" ]]; then
    echo "Warning: OCR worker not found. Run scripts/setup.sh or scripts/install_typhoon_ocr.sh."
    return 0
  fi

  echo "==> Starting OCR worker"
  "$ollama_bin" serve >/tmp/local-ai-helpdesk-ollama.log 2>&1 &
  CHILD_PIDS+=("$!")
  wait_for_url "${TYPHOON_OCR_BASE_URL:-http://127.0.0.1:11434}/api/tags" "OCR worker" 20 || true
}

if [[ ! -d node_modules ]]; then
  npm install
fi

if [[ ! -f dist/index.html ]]; then
  npm run build
fi

start_ocr

if port_open "$LLM_PORT"; then
  echo "==> Local AI model server already running on port $LLM_PORT"
else
  echo "==> Starting local AI model server on port $LLM_PORT"
  MODEL_SIZE="$MODEL_SIZE" LLM_PORT="$LLM_PORT" scripts/start_model.sh >/tmp/local-ai-helpdesk-model.log 2>&1 &
  CHILD_PIDS+=("$!")
  wait_for_url "http://127.0.0.1:$LLM_PORT/v1/models" "Local AI model" 120 || true
fi

if port_open "$WEB_PORT"; then
  echo "==> Web UI already running on port $WEB_PORT"
else
  echo "==> Starting Web UI on port $WEB_PORT"
  PORT="$WEB_PORT" node server.js &
  CHILD_PIDS+=("$!")
  wait_for_url "http://127.0.0.1:$WEB_PORT/api/health" "Web UI" 30 || true
fi

echo ""
echo "Local AI Helpdesk is running:"
echo "  Main app:       http://127.0.0.1:$WEB_PORT"
echo "  Knowledge chat: http://127.0.0.1:$WEB_PORT/knowledge-chat"
echo "  Admin:          http://127.0.0.1:$WEB_PORT/admin"
echo ""
echo "Press Ctrl+C to stop services started by this command."

wait
