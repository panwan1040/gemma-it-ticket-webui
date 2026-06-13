#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_OCR="${INSTALL_OCR:-1}"
CHAT_MODEL="${LLM_MODEL:-gemma4:e4b-it-qat}"
OCR_MODEL="${TYPHOON_OCR_MODEL:-scb10x/typhoon-ocr1.5-3b}"
OLLAMA_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"

cd "$ROOT_DIR"

echo "==> Local AI Helpdesk setup"
echo "    Runtime: Ollama"
echo "    Chat:    $CHAT_MODEL"
echo "    OCR:     $INSTALL_OCR"

if [[ "$OSTYPE" == darwin* ]] && ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required on macOS. Install it first: https://brew.sh"
  exit 1
fi

if [[ "$OSTYPE" == darwin* ]]; then
  for tool in node ollama pdftoppm; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      case "$tool" in
        pdftoppm) brew install poppler ;;
        ollama) brew install ollama ;;
        node) brew install node ;;
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

set_env_value() {
  local name="$1"
  local value="$2"
  if grep -q "^$name=" "$ROOT_DIR/.env"; then
    perl -0pi -e "s|^$name=.*$|$name=$value|m" "$ROOT_DIR/.env"
  else
    printf "\n%s=%s\n" "$name" "$value" >> "$ROOT_DIR/.env"
  fi
}

remove_env_value() {
  local name="$1"
  perl -0pi -e "s|^$name=.*\\n||m" "$ROOT_DIR/.env"
}

set_env_value "OLLAMA_BASE_URL" "$OLLAMA_URL"
set_env_value "LLM_MODEL" "$CHAT_MODEL"
set_env_value "TYPHOON_OCR_MODEL" "$OCR_MODEL"
set_env_value "PORT" "3000"
remove_env_value "LLM_BASE_URL"
remove_env_value "TYPHOON_OCR_BASE_URL"
remove_env_value "OLLAMA_VISION_BASE_URL"
remove_env_value "OLLAMA_VISION_MODEL"

npm install

if ! curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
  echo "==> Starting Ollama"
  ollama serve >/tmp/local-ai-helpdesk-ollama.log 2>&1 &
  for _ in {1..30}; do
    curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1 && break
    sleep 1
  done
fi

echo "==> Pulling chat model: $CHAT_MODEL"
ollama pull "$CHAT_MODEL"

if [[ "$INSTALL_OCR" != "0" ]]; then
  echo "==> Pulling OCR model: $OCR_MODEL"
  ollama pull "$OCR_MODEL"
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
