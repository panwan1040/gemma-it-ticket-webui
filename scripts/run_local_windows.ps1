param(
  [string]$Port = $(if ($env:PORT) { $env:PORT } else { '3000' })
)

$ErrorActionPreference = 'Stop'
$RootDir = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RootDir

function Read-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $parts = $line.Split('=', 2)
    if ($parts.Length -eq 2) {
      [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
    }
  }
}

function Test-Port([int]$PortNumber) {
  try {
    $client = New-Object Net.Sockets.TcpClient
    $client.Connect('127.0.0.1', $PortNumber)
    $client.Close()
    return $true
  } catch { return $false }
}

function Wait-Url([string]$Url, [string]$Label, [int]$Attempts = 60) {
  for ($i = 0; $i -lt $Attempts; $i++) {
    try {
      Invoke-RestMethod -Uri $Url -TimeoutSec 2 | Out-Null
      Write-Host "==> $Label is ready" -ForegroundColor Cyan
      return $true
    } catch { Start-Sleep -Seconds 1 }
  }
  Write-Warning "$Label did not become ready: $Url"
  return $false
}

Read-DotEnv '.env'
if ($env:PORT) { $Port = $env:PORT }

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  throw 'Ollama is not installed. Run npm run setup:windows first.'
}

try {
  Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 | Out-Null
  Write-Host '==> Ollama already running' -ForegroundColor Cyan
} catch {
  Write-Host '==> Starting Ollama' -ForegroundColor Cyan
  Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Minimized | Out-Null
  Wait-Url 'http://127.0.0.1:11434/api/tags' 'Ollama' 30 | Out-Null
}

if (-not (Test-Path 'node_modules')) {
  npm install
}

if (-not (Test-Path 'dist\index.html')) {
  npm run build
}

if (Test-Port ([int]$Port)) {
  Write-Host "==> Web UI already running on port $Port" -ForegroundColor Cyan
} else {
  Write-Host "==> Starting Web UI on port $Port" -ForegroundColor Cyan
  $env:PORT = $Port
  node server.js
  exit
}

Write-Host ''
Write-Host 'Local AI Helpdesk is running:' -ForegroundColor Green
Write-Host "  Main app:       http://127.0.0.1:$Port"
Write-Host "  Knowledge chat: http://127.0.0.1:$Port/knowledge-chat"
Write-Host "  Admin:          http://127.0.0.1:$Port/admin"
Write-Host ''
Write-Host 'Press Ctrl+C to stop this script. Ollama may keep running in the background.'
while ($true) { Start-Sleep -Seconds 3600 }
