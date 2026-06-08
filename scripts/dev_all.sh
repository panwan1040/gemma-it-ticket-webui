#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

trap 'kill 0' INT TERM EXIT

scripts/start_model.sh &
sleep 3
scripts/start_webui.sh &

wait
