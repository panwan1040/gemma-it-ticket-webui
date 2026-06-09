# Windows Portable Quick Start

This folder is a quick-launch entry point for Windows users.

## Install once

Open PowerShell in the repository folder and run:

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

Admin document library:

```text
http://127.0.0.1:3000/admin
```

The admin page is protected by `ADMIN_AUTH` and is not shown in the general user navigation.

## Notes

- The model files are not stored in git because they are several GB.
- The installer downloads models through Ollama.
- Windows uses Ollama as the main AI backend and OCR backend.
- Default main model: `hf.co/google/gemma-4-E4B-it-qat-q4_0-gguf`.
- Optional OCR model: `scb10x/typhoon-ocr1.5-3b`.

## Options

Install 12B instead of E4B:

```powershell
$env:MODEL_SIZE='12b'; powershell -ExecutionPolicy Bypass -File .\portable\windows\Install.ps1
```

Skip OCR:

```powershell
$env:INSTALL_OCR='0'; powershell -ExecutionPolicy Bypass -File .\portable\windows\Install.ps1
```
