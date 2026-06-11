# AI Ticket Desk

AI Ticket Desk is a small web app for creating IT support tickets from a problem description plus optional screenshots, photos, and PDFs.

It is an AI-assisted ticket composer, not a general chatbot. The user always reviews and edits the draft before saving.

## What It Does

- Accepts text-only issues, file-only issues, or both.
- Stores attachments safely under `data/attachments/`.
- Sends images to Gemma vision through Ollama for visual IT-support analysis.
- Sends images separately to SCB/Typhoon OCR through Ollama for Thai OCR.
- Sends only text outputs and attachment metadata to Gemma reasoning for structured ticket JSON.
- Lets the user edit the ticket draft before saving.
- Provides ticket list, ticket detail, status updates, attachment download, CSV export, JSON export, backup, and restore.

## What It Is Not

- Not a generic chatbot.
- Not a RAG or knowledge-base system.
- Not an Open WebUI clone.
- Not a model marketplace.
- Not a multi-user admin platform.

## Architecture

- Node.js + Express API
- SQLite with `better-sqlite3`
- Vite + React frontend
- Ollama direct `/api/generate` calls
- `multer` for uploads
- `sharp` for image metadata
- Basic Auth for ticket, attachment, and export routes

## Requirements

- Node.js 22+ recommended
- npm
- Ollama running locally or on an internal server
- Ollama models:

```bash
ollama pull gemma3:12b
ollama pull scb10x/typhoon-ocr1.5-3b
```

Use smaller or different models by changing `.env`.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```env
ADMIN_AUTH=admin:choose-a-real-password
OLLAMA_BASE_URL=http://127.0.0.1:11434
VISION_MODEL=gemma3:12b
OCR_MODEL=scb10x/typhoon-ocr1.5-3b
REASONING_MODEL=gemma3:12b
```

In production, `ADMIN_AUTH` must be set and must not be `admin:change-me`.

## Development

Terminal 1:

```bash
npm run dev:api
```

Terminal 2:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The Vite dev server proxies `/api` to the backend on port `3000`.

## Production

```bash
npm run build
NODE_ENV=production npm start
```

Open:

```text
http://127.0.0.1:3000
```

Public routes:

- `/`
- `/api/health`
- `/api/intake/analyze` with rate limiting

Protected by Basic Auth:

- `/tickets`
- `/api/tickets`
- `/api/tickets/:id`
- `/api/tickets/:id/attachments/:attachmentId`
- `/api/tickets-export.csv`
- `/api/tickets-export.json`

## Testing

```bash
npm test
npm run check
```

Tests use mocked Ollama responses. Real Ollama is not required for tests.

## Image And OCR Flow

For images:

1. The original file is stored.
2. The image is read as base64.
3. Vision analysis calls the configured vision model.
4. OCR calls the configured OCR model separately.
5. Reasoning receives only user text, vision text, OCR text, and metadata.
6. The JSON draft is validated before returning to the frontend.

If `AI_DEBUG=false`, analyze responses do not include debug metadata.

## PDF Limitation

PDF upload and storage are supported, but PDF-to-image conversion is not implemented in this version. The API returns a warning that PDF OCR conversion is not available yet. This avoids adding a fragile platform-specific converter dependency.

## Backup And Restore

Create a backup:

```bash
npm run backup
```

Backups are written to:

```text
data/backups/ai-ticket-desk-YYYYMMDD-HHMMSS.tar.gz
```

If `tar` is unavailable, the script creates a folder copy fallback. `.env` is never included.

Restore requires an explicit path and `--yes`:

```bash
npm run restore -- data/backups/ai-ticket-desk-20260611-120000.tar.gz --yes
```

Restore moves the existing `data/` directory aside before replacing it.

## Security Notes

- Attachments are not served as public static files.
- Attachment download validates that the file belongs to the requested ticket.
- File paths are checked to stay under `data/attachments/`.
- Only PNG, JPEG, WebP, and PDF uploads are accepted.
- Base64 image data is never logged.
- Health responses do not expose secrets.
- Basic Auth is intentionally simple; deploy behind HTTPS or an internal trusted network.

## Troubleshooting

Ollama unreachable:

```bash
ollama serve
curl http://127.0.0.1:11434/api/tags
```

Model missing:

```bash
ollama pull gemma3:12b
ollama pull scb10x/typhoon-ocr1.5-3b
```

Production refuses to start:

- Set `ADMIN_AUTH` to a non-default value.
- Confirm `DATA_DIR`, `ATTACHMENT_DIR`, and `DB_PATH` are writable.

Upload rejected:

- Check file size against `MAX_UPLOAD_MB`.
- Use PNG, JPEG, WebP, or PDF only.

AI returns invalid JSON:

- Try again with a lower temperature.
- Confirm the reasoning model follows JSON output well.
- Enable `AI_DEBUG=true` temporarily on an internal machine to inspect prompt lengths and cleaned JSON.
