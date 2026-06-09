#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
YES=0
ARCHIVE=""
for arg in "$@"; do
  case "$arg" in
    --yes) YES=1 ;;
    *) ARCHIVE="$arg" ;;
  esac
done
if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Usage: scripts/restore_data.sh [--yes] backups/gemma-helpdesk-data-YYYYMMDD-HHMMSS.tar.gz" >&2
  exit 1
fi
if [ "$YES" -ne 1 ]; then
  echo "This will restore data files into $ROOT_DIR and may overwrite current local data."
  read -r -p "Type RESTORE to continue: " confirm
  if [ "$confirm" != "RESTORE" ]; then
    echo "Restore cancelled."
    exit 1
  fi
fi
mkdir -p "$ROOT_DIR/data" "$ROOT_DIR/knowledge"
tar -xzf "$ARCHIVE" -C "$ROOT_DIR"
echo "Restore completed from $ARCHIVE"
