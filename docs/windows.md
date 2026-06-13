# Windows Setup

This project uses Ollama as the only local model runtime on Windows.

## Requirements

- Windows 10 or 11
- PowerShell 5+
- winget

## Install

```powershell
npm run setup:windows
```

The setup script installs or checks:

- Node.js LTS
- Ollama
- Poppler, when OCR is enabled

It also pulls:

```text
gemma4:e4b-it-qat
scb10x/typhoon-ocr1.5-3b
```

Skip OCR download:

```powershell
$env:INSTALL_OCR='0'; npm run setup:windows
```

## Run

```powershell
npm run local:windows
```

Open:

```text
http://127.0.0.1:3000
```

## Environment

The app uses these model settings:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
LLM_MODEL=gemma4:e4b-it-qat
TYPHOON_OCR_MODEL=scb10x/typhoon-ocr1.5-3b
```
