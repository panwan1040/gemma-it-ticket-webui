param(
  [ValidateSet('e4b','12b')]
  [string]$ModelSize = $(if ($env:MODEL_SIZE) { $env:MODEL_SIZE } else { 'e4b' }),
  [string]$InstallOcr = $(if ($env:INSTALL_OCR) { $env:INSTALL_OCR } else { '1' })
)

$ErrorActionPreference = 'Stop'
$RootDir = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RootDir

function Write-Step([string]$Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Command-Exists([string]$Command) {
  $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Install-WingetPackage([string]$Id, [string]$Name) {
  if (-not (Command-Exists winget)) {
    throw 'winget is required. Install App Installer from Microsoft Store, then run this script again.'
  }
  Write-Step "Installing/checking $Name"
  winget install --id $Id --exact --accept-package-agreements --accept-source-agreements --silent | Out-Host
}

function Ensure-Command([string]$Command, [string]$PackageId, [string]$Name) {
  if (-not (Command-Exists $Command)) {
    Install-WingetPackage $PackageId $Name
  } else {
    Write-Step "$Name already installed"
  }
}

function Set-EnvValue([string]$Path, [string]$Name, [string]$Value) {
  $content = Get-Content $Path -Raw
  $line = "$Name=$Value"
  if ($content -match "(?m)^$([regex]::Escape($Name))=") {
    $content = $content -replace "(?m)^$([regex]::Escape($Name))=.*$", $line
  } else {
    if (-not $content.EndsWith("`n")) { $content += "`n" }
    $content += "$line`n"
  }
  Set-Content -Path $Path -Value $content -Encoding UTF8
}

function Start-OllamaIfNeeded {
  try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 | Out-Null
    Write-Step 'Ollama is already running'
    return
  } catch {}

  Write-Step 'Starting Ollama'
  Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Minimized | Out-Null
  for ($i = 0; $i -lt 30; $i++) {
    try {
      Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 | Out-Null
      Write-Step 'Ollama is ready'
      return
    } catch { Start-Sleep -Seconds 1 }
  }
  throw 'Ollama did not become ready on http://127.0.0.1:11434'
}

function Add-PopplerToPathIfFound {
  if (Command-Exists pdftoppm) { return }
  $candidates = @(
    'C:\Program Files\poppler*\Library\bin',
    'C:\Program Files\poppler*\bin',
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\*Poppler*\*\Library\bin"
  )
  foreach ($pattern in $candidates) {
    $match = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($match) {
      $currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
      if ($currentPath -notlike "*$($match.FullName)*") {
        [Environment]::SetEnvironmentVariable('Path', "$currentPath;$($match.FullName)", 'User')
      }
      $env:Path = "$env:Path;$($match.FullName)"
      Write-Step "Added Poppler to PATH: $($match.FullName)"
      return
    }
  }
}

Write-Step 'Local AI Helpdesk Windows setup'
Write-Host "    Model: $ModelSize"
Write-Host "    OCR:   $InstallOcr"

Ensure-Command node 'OpenJS.NodeJS.LTS' 'Node.js LTS'
Ensure-Command npm 'OpenJS.NodeJS.LTS' 'npm'
Ensure-Command ollama 'Ollama.Ollama' 'Ollama'

if ($InstallOcr -ne '0') {
  if (-not (Command-Exists pdftoppm)) {
    Install-WingetPackage 'oschwartz10612.Poppler' 'Poppler for Windows'
    Add-PopplerToPathIfFound
  }
}

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Step 'Created .env from .env.example'
} else {
  Write-Step 'Keeping existing .env'
}

if ($ModelSize -eq '12b') {
  $mainModel = 'hf.co/google/gemma-4-12B-it-qat-q4_0-gguf'
} else {
  $mainModel = 'hf.co/google/gemma-4-E4B-it-qat-q4_0-gguf'
}

Set-EnvValue '.env' 'LLM_BASE_URL' 'http://127.0.0.1:11434/v1'
Set-EnvValue '.env' 'LLM_MODEL' $mainModel
Set-EnvValue '.env' 'PORT' '3000'
Set-EnvValue '.env' 'TYPHOON_OCR_BASE_URL' 'http://127.0.0.1:11434'
Set-EnvValue '.env' 'TYPHOON_OCR_MODEL' 'scb10x/typhoon-ocr1.5-3b'

Write-Step 'Installing npm dependencies'
npm install

Start-OllamaIfNeeded

Write-Step "Pulling main model: $mainModel"
ollama pull $mainModel

if ($InstallOcr -ne '0') {
  Write-Step 'Pulling OCR model: scb10x/typhoon-ocr1.5-3b'
  ollama pull 'scb10x/typhoon-ocr1.5-3b'
}

Write-Step 'Indexing knowledge library'
npm run index:knowledge

Write-Step 'Building production web UI'
npm run build

Write-Host ''
Write-Host 'Setup complete.' -ForegroundColor Green
Write-Host 'Run everything with:'
Write-Host '  npm run local:windows'
Write-Host ''
Write-Host 'Open:'
Write-Host '  http://127.0.0.1:3000'
