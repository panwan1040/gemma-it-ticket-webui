# Windows Setup

This project supports Windows through Ollama.

The Windows path intentionally avoids building `llama.cpp` locally because that is harder to support across CPU, CUDA, Vulkan, and compiler setups.

## Install

```powershell
git clone https://github.com/panwan1040/gemma-it-ticket-webui.git
cd gemma-it-ticket-webui
npm run setup:windows
```

## Run

```powershell
npm run local:windows
```

## Portable launcher

```powershell
powershell -ExecutionPolicy Bypass -File .\portable\windows\Install.ps1
powershell -ExecutionPolicy Bypass -File .\portable\windows\Run.ps1
```

## What gets installed

- Node.js LTS
- Ollama
- Poppler for PDF OCR
- Main Gemma GGUF model through Ollama
- Typhoon OCR model through Ollama
- npm dependencies

## Configuration

Windows setup writes these `.env` values:

```text
LLM_BASE_URL=http://127.0.0.1:11434/v1
LLM_MODEL=hf.co/google/gemma-4-E4B-it-qat-q4_0-gguf
TYPHOON_OCR_BASE_URL=http://127.0.0.1:11434
TYPHOON_OCR_MODEL=scb10x/typhoon-ocr1.5-3b
```

## Notes

- Model files are not committed to git.
- First install can take a long time because the models are several GB.
- If `pdftoppm` is not found after installing Poppler, open a new PowerShell window and run again.
- If Ollama is already running, the run script reuses it.
