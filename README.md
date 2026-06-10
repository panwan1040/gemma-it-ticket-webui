# Local AI Helpdesk

Local-first, self-hosted IT helpdesk web app for Thai support workflows.

The app helps internal support teams collect issue details, draft a work order, save tickets locally, optionally send rows to Google Sheets, and answer questions from a local knowledge library.

## Features

- Thai-first IT ticket intake assistant
- Local Gemma model through `llama.cpp`
- Work order draft with editable fields
- Chat file attachments for screenshots, error images, and PDFs
- Optional OCR for attached images/PDFs before ticket drafting
- Local ticket log at `data/tickets.jsonl`
- Optional Google Sheets webhook
- Knowledge chat page at `/knowledge-chat`
- Protected Document Library admin page at `/admin`
- Optional Typhoon OCR worker for PDF/image ingestion
- Local RAG over Markdown files in `knowledge/`
- Open-source friendly app branding through `.env`

## Recommended machine

- Apple Silicon Mac
- macOS latest stable
- 16GB unified memory or more
- Homebrew installed

Default setup uses Gemma E4B QAT because it is smoother on 16GB machines than 12B.

## Quick start on macOS

Clone the repo, then run setup once:

```zsh
npm run setup
```

This command will:

- create `.env` from `.env.example` if missing
- install npm dependencies
- build latest `llama.cpp` with Metal support
- download the default Gemma E4B QAT GGUF model
- install the Typhoon OCR worker through Ollama app on macOS
- install Poppler for PDF page conversion
- build the production web UI
- index the knowledge folder

Then run everything with one command:

```zsh
npm run local
```

Open:

```text
http://127.0.0.1:3000
```

Useful pages:

```text
http://127.0.0.1:3000             IT ticket intake for general users
http://127.0.0.1:3000/knowledge-chat  Knowledge chat for general users
http://127.0.0.1:3000/admin       Protected admin document library
```

The general user navigation only shows the ticket intake and knowledge chat pages. Admins open `/admin` directly.

Admin auth comes from `.env` and protects `/admin` plus admin APIs.

```zsh
ADMIN_AUTH=admin:use-a-long-random-password
```

In development, the server can run without `ADMIN_AUTH` and will log that a dev-only fallback is active. In production, `NODE_ENV=production npm start` fails fast if `ADMIN_AUTH` is missing or set to an unsafe default such as `admin:change-me`. The server never logs the credential value.

## One-command run behavior

`npm run local` starts:

- OCR worker, if available
- local Gemma model server on `127.0.0.1:18080`
- web UI on `127.0.0.1:3000`

If a service is already running, the script leaves it alone.

Stop services started by the command with:

```text
Ctrl+C
```

## Setup options

Install 12B instead of E4B:

```zsh
MODEL_SIZE=12b npm run setup
```

Skip OCR installation:

```zsh
INSTALL_OCR=0 npm run setup
```

Run without starting OCR:

```zsh
START_OCR=0 npm run local
```

Use a different context size:

```zsh
CTX_SIZE=4096 npm run local
```

## Configuration

Edit `.env`:

```zsh
APP_NAME=Local AI Helpdesk
APP_TAGLINE=AI-assisted ticket intake for internal support teams
APP_DESCRIPTION=Collect issue details, draft tickets, and save them to your support workflow.

LLM_BASE_URL=http://127.0.0.1:18080/v1
LLM_MODEL=gemma4-e4b-qat
LLM_TIMEOUT_MS=25000
PORT=3000

GOOGLE_SHEET_WEBHOOK_URL=
ADMIN_AUTH=admin:use-a-long-random-password

TYPHOON_OCR_BASE_URL=http://127.0.0.1:11434
TYPHOON_OCR_MODEL=scb10x/typhoon-ocr1.5-3b
TYPHOON_OCR_MAX_PDF_PAGES=3
TYPHOON_OCR_MAX_UPLOAD_MB=24
```

Public branding values are exposed through `/api/config`.

Secrets stay server-side:

- `ADMIN_AUTH`
- `GOOGLE_SHEET_WEBHOOK_URL`

## Production hardening notes

- Set `ADMIN_AUTH` before real use. Unsafe defaults are rejected when `NODE_ENV=production`.
- Admin-only APIs include model selection, model listing, RAG search, ticket dashboard, diagnostics, knowledge management, OCR parsing, and attachment downloads.
- Uploaded files are stored under `data/attachments/` and are not served as public static files. Admin downloads go through `/api/admin/attachments/:day/:filename`.
- Ticket saves generate IDs like `IT-YYYYMMDD-0001` and start with status `New`.
- Rate limits are in-memory and configurable through `.env`. Defaults: general 120/15m, chat 30/15m, upload/OCR 10/15m, tickets 30/15m.
- LLM calls time out using `LLM_TIMEOUT_MS` so the UI can fall back instead of waiting forever.
- RAG prompt context is capped by `RAG_MAX_DOCS`, `RAG_MAX_CHARS_PER_DOC`, and `RAG_MAX_TOTAL_CONTEXT_CHARS`.

## Production runbook

1. Copy `.env.production.example` to `.env` and set a strong `ADMIN_AUTH`.
2. Start the local model/OCR services with `npm run local` or your service manager.
3. Start the web UI with `NODE_ENV=production npm start`.
4. Open `/admin` and check the `สถานะระบบ` tab for LLM, OCR, Poppler, data directory, attachment directory, Google Sheet, and knowledge index status.
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

Backups include `data/tickets.jsonl`, `data/attachments/`, `data/rag-index.json`, and `knowledge/`. Restores may overwrite local data, so stop the server first.

Admin mutations write audit entries to `data/admin-audit.jsonl`. Audit rows include timestamp, action, target, success/failure, and IP. Secrets such as `ADMIN_AUTH` and webhook URLs are never logged.

Windows note: backup/restore scripts are currently macOS/Linux shell scripts. On Windows, use WSL/Git Bash or manually back up the same `data/` and `knowledge/` paths.

Bundle-size note: the current Vite build can warn that the main JS chunk is larger than 500KB because the app still ships public and admin UI from one React entry plus Markdown rendering. This is documented as a follow-up; code-splitting admin-only UI is possible but was not done in this pass to avoid destabilizing the merged production-hardening UI.

## Google Sheets webhook

1. Create a Google Sheet.
2. Go to Extensions > Apps Script.
3. Paste `google-apps-script.gs`.
4. Deploy > New deployment > Web app.
5. Execute as: Me.
6. Who has access: Anyone with the link.
7. Copy the Web app URL.
8. Put it in `.env`.

```zsh
GOOGLE_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/xxxx/exec
```

If the webhook is empty, tickets are still saved locally.

Attachments are saved locally in:

```text
data/attachments/
```

Google Sheets receives attachment names/paths and OCR text summary, not the binary file itself. This keeps Sheet logging stable and avoids Apps Script upload limits.

If local save succeeds but webhook fails, the UI shows:

```text
บันทึกในเครื่องแล้ว แต่ส่ง webhook ไม่สำเร็จ
```

## PEA electricity bill extractor

The `/electricity-bills` page is a separate workflow for Thai PEA electricity invoices.

Recommended flow:

1. Upload a PDF/image electricity bill.
2. Typhoon OCR reads the document locally.
3. The app extracts a fixed JSON schema for the invoice.
4. The user reviews and edits JSON before saving.
5. The app saves locally to `data/electricity-bills.jsonl`.
6. If configured, the app posts the reviewed payload to Google Sheets.

Set a separate webhook for this workflow:

```zsh
ELECTRICITY_BILL_WEBHOOK_URL=https://script.google.com/macros/s/xxxx/exec
```

Use `google-electricity-bill-apps-script.gs` as the Apps Script template for this sheet.

Keep this separate from `GOOGLE_SHEET_WEBHOOK_URL` unless your Apps Script supports both ticket rows and electricity bill rows. Electricity bill payloads include nested `invoice` JSON plus flat fields such as `ca_ref_no`, `invoice_no`, `bill_period`, `total_kwh`, `subtotal`, `vat_amount`, `grand_total`, and validation flags.

The extractor intentionally returns `null` and marks fields in `confidence.low_confidence_fields` when OCR is unclear. Users should review the JSON before sending it to Sheets.

## Chat Markdown support

Assistant responses render GitHub-Flavored Markdown in the chat UI, including:

- headings
- bullet and numbered lists
- fenced code blocks
- blockquotes
- tables

Raw HTML is not enabled in chat rendering. OCR and model prompts prefer Markdown tables so answers stay readable and safer to render.

## Knowledge library

Markdown knowledge files live in:

```text
knowledge/
```

Admin page, protected by `ADMIN_AUTH` and intentionally hidden from the general user menu:

```text
http://127.0.0.1:3000/admin
```

Workflow:

```text
Add document -> OCR draft if needed -> Review Markdown -> Save to knowledge library -> Ask in Knowledge Chat
```

Reindex manually:

```zsh
npm run index:knowledge
```

Knowledge chat:

```text
http://127.0.0.1:3000/knowledge-chat
```

## OCR notes

Typhoon OCR is optional but useful for PDF/image documents.

Install or refresh OCR:

```zsh
scripts/install_typhoon_ocr.sh
```

On macOS, the script prefers:

```text
/Applications/Ollama.app/Contents/Resources/ollama
```

This avoids Homebrew formula issues where some Ollama builds miss the helper binary used during inference.

By default, PDF OCR is limited to the first 3 pages per file to reduce memory pressure.

## Model defaults

Default:

- Model: Gemma E4B QAT Q4 GGUF
- Context: 8192
- Batch size: 1024
- Micro-batch: 256
- GPU layers: 99
- Metal: enabled through `llama.cpp`
- KV cache: `q8_0`
- Reasoning: off
- Server: `http://127.0.0.1:18080/v1`

Download model manually:

```zsh
MODEL_SIZE=e4b scripts/download_model.sh
MODEL_SIZE=12b scripts/download_model.sh
```

Start model manually:

```zsh
MODEL_SIZE=e4b CTX_SIZE=8192 scripts/start_model.sh
MODEL_SIZE=12b CTX_SIZE=8192 scripts/start_model.sh
```

## Memory monitoring

```zsh
memory_pressure
vm_stat
top -o mem
```

For Mac 16GB:

- prefer E4B
- keep context at 8192 or lower
- avoid running 12B and OCR-heavy PDF jobs at the same time
- lower `CTX_SIZE` to `4096` if swap grows

## Development commands

```zsh
npm run build
npm start
npm run dev
npm run dev:api
npm run index:knowledge
```

Legacy scripts still work:

```zsh
scripts/start_model.sh
scripts/start_webui.sh
scripts/dev_all.sh
```

For new installs, prefer:

```zsh
npm run setup
npm run local
```

## Windows quick start

Windows is supported through Ollama, not through local `llama.cpp` builds.

Recommended for Windows 10/11:

- PowerShell
- winget
- Ollama for Windows
- Node.js LTS
- Optional Poppler for PDF OCR

Clone the repo, then run setup once:

```powershell
npm run setup:windows
```

This command will:

- create `.env` from `.env.example` if missing
- install/check Node.js and Ollama through winget
- install/check Poppler for PDF OCR
- set `LLM_BASE_URL=http://127.0.0.1:11434/v1`
- set the main model to `hf.co/google/gemma-4-E4B-it-qat-q4_0-gguf`
- pull the main model through Ollama
- pull Typhoon OCR if enabled
- install npm dependencies
- build the web UI

Run everything:

```powershell
npm run local:windows
```

Open:

```text
http://127.0.0.1:3000
```

Windows options:

```powershell
$env:MODEL_SIZE='12b'; npm run setup:windows
$env:INSTALL_OCR='0'; npm run setup:windows
```

## Windows portable folder

For quick release-style installation, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\portable\windows\Install.ps1
powershell -ExecutionPolicy Bypass -File .\portable\windows\Run.ps1
```

The portable folder does not commit model files into git. It downloads models on first install.

Windows backend notes:

- Main LLM backend: Ollama OpenAI-compatible API
- Main LLM URL: `http://127.0.0.1:11434/v1`
- OCR backend: Ollama native API
- Default Windows model: `hf.co/google/gemma-4-E4B-it-qat-q4_0-gguf`
- Default OCR model: `scb10x/typhoon-ocr1.5-3b`

Ollama OpenAI compatibility is documented here:

```text
https://docs.ollama.com/openai
```

Ollama with Hugging Face GGUF models is documented here:

```text
https://huggingface.co/docs/hub/en/ollama
```

## Notes for open-source reuse

- Do not commit `.env`.
- Do not commit model files.
- Put organization-specific SOPs in `knowledge/`, not in source code.
- Rename the app through `.env` instead of editing React components.
- Keep private workflow details out of prompts and defaults.
