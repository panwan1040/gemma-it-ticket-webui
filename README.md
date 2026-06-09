# Local AI Helpdesk

Local-first, self-hosted IT helpdesk web app for Thai support workflows.

The app helps internal support teams collect issue details, draft a work order, save tickets locally, optionally send rows to Google Sheets, and answer questions from a local knowledge library.

## Features

- Thai-first IT ticket intake assistant
- Local Gemma model through `llama.cpp`
- Work order draft with editable fields
- Local ticket log at `data/tickets.jsonl`
- Optional Google Sheets webhook
- Document Library admin page at `/admin`
- Knowledge chat page at `/knowledge-chat`
- Optional Typhoon OCR worker for PDF/image ingestion
- Local RAG over Markdown files in `knowledge/`
- Open-source friendly app branding through `.env`

## Recommended machine

- Apple Silicon Mac
- macOS latest stable
- 16GB unified memory or more
- Homebrew installed

Default setup uses Gemma E4B QAT because it is smoother on 16GB machines than 12B.

## Quick start on a new machine

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
http://127.0.0.1:3000             IT ticket intake
http://127.0.0.1:3000/knowledge-chat
http://127.0.0.1:3000/admin
```

Default admin auth comes from `.env`:

```zsh
ADMIN_AUTH=admin:change-me
```

Change this before real use.

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
PORT=3000

GOOGLE_SHEET_WEBHOOK_URL=
ADMIN_AUTH=admin:change-me

TYPHOON_OCR_BASE_URL=http://127.0.0.1:11434
TYPHOON_OCR_MODEL=scb10x/typhoon-ocr1.5-3b
TYPHOON_OCR_MAX_PDF_PAGES=3
TYPHOON_OCR_MAX_UPLOAD_MB=24
```

Public branding values are exposed through `/api/config`.

Secrets stay server-side:

- `ADMIN_AUTH`
- `GOOGLE_SHEET_WEBHOOK_URL`

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

If local save succeeds but webhook fails, the UI shows:

```text
บันทึกในเครื่องแล้ว แต่ส่ง webhook ไม่สำเร็จ
```

## Knowledge library

Markdown knowledge files live in:

```text
knowledge/
```

Admin page:

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

## Notes for open-source reuse

- Do not commit `.env`.
- Do not commit model files.
- Put organization-specific SOPs in `knowledge/`, not in source code.
- Rename the app through `.env` instead of editing React components.
- Keep private workflow details out of prompts and defaults.
