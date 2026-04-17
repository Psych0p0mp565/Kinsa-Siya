# Push to GitHub after choosing which account authenticates.
# Run from repo root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\push-as.ps1
#
# Git Credential Manager keys HTTPS logins by URL. Putting the username in
# https://YOU@github.com/... keeps tokens separate per GitHub user on this machine.
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$ownerRepo = "Psych0p0mp565/Kinsa-Siya"

Write-Host ""
Write-Host "Repository: https://github.com/$ownerRepo" -ForegroundColor Cyan
Write-Host "Pick which identity signs in for this push. To keep accounts separate on GitHub, use [1] for this repo" -ForegroundColor Gray
Write-Host "(owner). Use [2] only for a different remote/repo where that user has access." -ForegroundColor Gray
Write-Host ""
Write-Host "  [1] Psych0p0mp565"
Write-Host "  [2] Juan45-dev"
Write-Host "  [3] Other (type username)"
Write-Host ""
$choice = (Read-Host "Choice (1-3)").Trim()

switch ($choice) {
  "1" { $user = "Psych0p0mp565" }
  "2" { $user = "Juan45-dev" }
  "3" { $user = (Read-Host "GitHub username").Trim() }
  default {
    if ($choice -match "^\w[\w-]*$") { $user = $choice }
    else {
      Write-Host "Invalid choice. Run again and enter 1, 2, 3, or a username." -ForegroundColor Yellow
      exit 1
    }
  }
}

if ([string]::IsNullOrWhiteSpace($user)) {
  Write-Host "No username selected." -ForegroundColor Yellow
  exit 1
}

$originUrl = "https://${user}@github.com/${ownerRepo}.git"
Write-Host ""
Write-Host "Setting origin to: $originUrl" -ForegroundColor Gray
git remote set-url origin $originUrl

Write-Host "Pushing main..." -ForegroundColor Cyan
git push -u origin main

Write-Host ""
Write-Host "Done. Future pushes from this clone use the same origin until you change it or run this script again." -ForegroundColor Gray
Write-Host ""
