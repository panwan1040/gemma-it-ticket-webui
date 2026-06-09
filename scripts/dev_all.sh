#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "scripts/dev_all.sh is kept for compatibility."
echo "Recommended command: npm run local"
echo ""

exec scripts/run_local.sh
