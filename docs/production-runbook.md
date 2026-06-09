# Production runbook

Use this checklist when running the local helpdesk in production-like mode.

1. Copy `.env.production.example` to `.env` and set a strong `ADMIN_AUTH`.
2. Start the local model/OCR services with `npm run local` or your service manager.
3. Start the web UI with `NODE_ENV=production npm start`.
4. Open `/admin` and check the system status tab for LLM, OCR, Poppler, data directory, attachment directory, Google Sheet, and knowledge index status.
5. Back up local data regularly:

```zsh
npm run backup
```

6. Validate ticket logs after upgrades or manual edits:

```zsh
npm run validate:tickets
```

7. Archive old tickets with a dry run first:

```zsh
npm run archive:tickets -- --before=2026-01-01
npm run archive:tickets -- --before=2026-01-01 --apply
```

8. Restore only from a trusted backup and confirm intentionally:

```zsh
scripts/restore_data.sh backups/gemma-helpdesk-data-YYYYMMDD-HHMMSS.tar.gz
scripts/restore_data.sh --yes backups/gemma-helpdesk-data-YYYYMMDD-HHMMSS.tar.gz
```

Backups include:

- `data/tickets.jsonl`
- `data/attachments/`
- `data/rag-index.json`
- `knowledge/`
- `data/admin-audit.jsonl`
- `data/archive/`

Restores may overwrite local data, so stop the server first.

Admin mutations should write audit entries to `data/admin-audit.jsonl`. Audit rows should include timestamp, action, target, success/failure, IP, and detail. Secrets such as `ADMIN_AUTH` and webhook URLs must never be logged.

Windows note: backup/restore scripts are currently macOS/Linux shell scripts. On Windows, use WSL/Git Bash or manually back up the same `data/` and `knowledge/` paths.
