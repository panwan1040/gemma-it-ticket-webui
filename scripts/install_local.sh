#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "scripts/install_local.sh is kept for compatibility."
echo "Recommended command: npm run setup"
echo ""

exec scripts/setup.sh
