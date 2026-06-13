# Windows Portable Quick Start

This folder is a quick-launch entry point for Windows users.

## Install Once

```powershell
powershell -ExecutionPolicy Bypass -File .\portable\windows\Install.ps1
```

## Run

```powershell
powershell -ExecutionPolicy Bypass -File .\portable\windows\Run.ps1
```

Open:

```text
http://127.0.0.1:3000
```

## Notes

- Runtime: Ollama
- Chat model: `gemma4:e4b-it-qat`
- OCR model: `scb10x/typhoon-ocr1.5-3b`

Skip OCR download:

```powershell
$env:INSTALL_OCR='0'; powershell -ExecutionPolicy Bypass -File .\portable\windows\Install.ps1
```
