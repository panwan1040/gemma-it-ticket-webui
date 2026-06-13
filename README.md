# Gemma IT Ticket Web UI

Local Thai-first IT helpdesk chat and OCR web UI powered by Ollama.

## What It Uses

- Runtime: Ollama only
- Chat and vision model: `gemma4:e4b-it-qat`
- OCR model: `scb10x/typhoon-ocr1.5-3b`
- Web app: React/Vite frontend with Node/Express backend
- Storage: local JSONL files, with optional Google Sheets webhooks

## Setup

```bash
npm run setup
```

The setup script installs dependencies, creates `.env`, pulls the required Ollama models, indexes the local knowledge folder, and builds the web UI.

To skip OCR model download:

```bash
INSTALL_OCR=0 npm run setup
```

## Run Locally

```bash
npm run local
```

Open:

```text
http://127.0.0.1:3000
```

For frontend-only development:

```bash
npm run dev
```

For backend development:

```bash
npm run dev:api
```

## Required Ollama Models

```bash
ollama pull gemma4:e4b-it-qat
ollama pull scb10x/typhoon-ocr1.5-3b
```

The app talks to Ollama through:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
LLM_MODEL=gemma4:e4b-it-qat
TYPHOON_OCR_MODEL=scb10x/typhoon-ocr1.5-3b
```

## Features

- ChatGPT/Open WebUI-style dark chat interface
- Streaming assistant responses through Ollama `/api/chat`
- Image attachments sent to vision-capable Ollama models
- OCR Studio for images, PDFs, text, and Markdown files
- Thai IT support ticket drafting
- Admin ticket list and local ticket logging
- Optional Google Sheets export through webhook URLs
- Local knowledge search for support answers

## Scripts

```bash
npm run setup            # install and prepare local Ollama models
npm run local            # start Ollama if needed and serve the app
npm run build            # build frontend assets
npm test                 # run Node tests
npm run check            # test + build
npm run index:knowledge  # rebuild local RAG index
```

Windows equivalents:

```powershell
npm run setup:windows
npm run local:windows
```

## Environment

Copy `.env.example` to `.env` and adjust only what you need.

Important values:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
LLM_MODEL=gemma4:e4b-it-qat
TYPHOON_OCR_MODEL=scb10x/typhoon-ocr1.5-3b
ADMIN_AUTH=admin:change-this-password
GOOGLE_SHEET_WEBHOOK_URL=
ELECTRICITY_BILL_WEBHOOK_URL=
```

In production, set a strong `ADMIN_AUTH`.

## Data

Local runtime data lives under `data/`:

- `data/tickets.jsonl`
- `data/attachments/`
- `data/rag-index.json`
- `data/admin-audit.jsonl`

Backups:

```bash
npm run backup
npm run restore
```
