# Run from repo root:  powershell -ExecutionPolicy Bypass -File .\scripts\install-deps.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

function Find-Npm {
  $cmd = Get-Command npm -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $paths = @(
    (Join-Path $env:ProgramFiles "nodejs\npm.cmd"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs\npm.cmd"),
    (Join-Path $env:LOCALAPPDATA "Programs\nodejs\npm.cmd"),
    (Join-Path $env:ProgramFiles "nodejs\npm")
  )
  foreach ($p in $paths) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

$npm = Find-Npm
if (-not $npm) {
  Write-Host ""
  Write-Host "npm was not found. Install Node.js LTS (includes npm), then reopen this terminal." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Option A — Installer: https://nodejs.org/en/download (Windows Installer (.msi))" -ForegroundColor Cyan
  Write-Host "Option B — winget (admin PowerShell): winget install OpenJS.NodeJS.LTS" -ForegroundColor Cyan
  Write-Host ""
  exit 1
}

Write-Host "Using npm at: $npm" -ForegroundColor Green
& $npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building shared package..." -ForegroundColor Green
& $npm run build -w shared
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. In this repo you can run:" -ForegroundColor Green
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
