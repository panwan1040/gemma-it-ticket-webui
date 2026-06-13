#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

WEB_PORT="${PORT:-3000}"
OLLAMA_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
CHAT_MODEL="${LLM_MODEL:-gemma4:e4b-it-qat}"
OCR_MODEL="${TYPHOON_OCR_MODEL:-scb10x/typhoon-ocr1.5-3b}"
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
  local attempts="${3:-60}"
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

find_ollama() {
  if command -v ollama >/dev/null 2>&1; then
    command -v ollama
    return 0
  fi
  if [[ -x "/Applications/Ollama.app/Contents/Resources/ollama" ]]; then
    echo "/Applications/Ollama.app/Contents/Resources/ollama"
    return 0
  fi
  return 1
}

ensure_ollama() {
  if curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
    echo "==> Ollama already running"
    return 0
  fi

  local ollama_bin
  ollama_bin="$(find_ollama || true)"
  if [[ -z "$ollama_bin" ]]; then
    echo "Ollama is required. Run npm run setup or install Ollama from https://ollama.com"
    exit 1
  fi

  echo "==> Starting Ollama"
  "$ollama_bin" serve >/tmp/local-ai-helpdesk-ollama.log 2>&1 &
  CHILD_PIDS+=("$!")
  wait_for_url "$OLLAMA_URL/api/tags" "Ollama" 30 || true
}

warn_if_model_missing() {
  local model="$1"
  local label="$2"
  local ollama_bin
  ollama_bin="$(find_ollama || true)"
  if [[ -z "$ollama_bin" ]]; then
    return 0
  fi
  if ! "$ollama_bin" list | awk 'NR > 1 { print $1 }' | grep -Fxq "$model"; then
    echo "Warning: $label model is not installed: $model"
    echo "         Run: ollama pull $model"
  fi
}

if [[ ! -d node_modules ]]; then
  npm install
fi

if [[ ! -f dist/index.html ]]; then
  npm run build
fi

ensure_ollama
warn_if_model_missing "$CHAT_MODEL" "chat"
warn_if_model_missing "$OCR_MODEL" "OCR"

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
echo "  Ollama:         $OLLAMA_URL"
echo ""
echo "Press Ctrl+C to stop services started by this command."

wait
