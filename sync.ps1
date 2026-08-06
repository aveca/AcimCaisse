# AcimCaisse Sync Script
# Usage: .\sync.ps1 "fix: description du changement"
# Effectue: syntax check → test Playwright → commit → push GitHub Pages
#
param([Parameter(Mandatory=$true)][string]$msg)

$repo = "C:\Users\user\Documents\Backup\ACIM\AcimCaisse-repo"
$tests = "C:\Users\user\Documents\Backup\ACIM"

Write-Host "1. Syntax check..." -ForegroundColor Cyan
node -c "$repo\acim-caisse.js"
if(!$?){ Write-Host "SYNTAX ERROR — abort" -ForegroundColor Red; exit 1 }
Write-Host "✓ Syntax OK" -ForegroundColor Green

Write-Host "2. Playwright tests..." -ForegroundColor Cyan
Push-Location $tests
node test-user-paths.js
$testOk = $?
Pop-Location
if(!$testOk){ Write-Host "TESTS FAILED — abort" -ForegroundColor Red; exit 1 }
Write-Host "✓ Tests passed" -ForegroundColor Green

Write-Host "3. Git commit + push..." -ForegroundColor Cyan
Push-Location $repo
git add -A
git commit -m $msg
git push origin gh-pages
Pop-Location
Write-Host "✓ Pushed to GitHub Pages" -ForegroundColor Green

Write-Host "4. Live URL: https://aveca.github.io/AcimCaisse/pos.html" -ForegroundColor Yellow
Write-Host "5. Add entry to CHANGELOG.md" -ForegroundColor Yellow
