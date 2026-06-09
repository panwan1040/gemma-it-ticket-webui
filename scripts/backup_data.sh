#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/gemma-helpdesk-data-$STAMP.tar.gz"
mkdir -p "$BACKUP_DIR"
cd "$ROOT_DIR"
items=()
[ -f data/tickets.jsonl ] && items+=(data/tickets.jsonl)
[ -d data/attachments ] && items+=(data/attachments)
[ -f data/rag-index.json ] && items+=(data/rag-index.json)
[ -f data/admin-audit.jsonl ] && items+=(data/admin-audit.jsonl)
[ -d data/archive ] && items+=(data/archive)
[ -d knowledge ] && items+=(knowledge)
if [ ${#items[@]} -eq 0 ]; then
  echo "No data files found to back up." >&2
  exit 1
fi
tar -czf "$OUT" "${items[@]}"
echo "$OUT"
