$ErrorActionPreference = 'Stop'
$RootDir = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $RootDir
& (Join-Path $RootDir 'scripts\setup_windows.ps1') @args
