# Package Story Time Universe for Samsung TV (Tizen).
# Usage:  .\scripts\package.ps1
# Optional: .\scripts\package.ps1 -Profile samsungtv -Target emulator-26101

param(
    [string]$Profile = "samsungtv",
    [string]$Target = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$Tizen = "C:\tizen-studio\tools\ide\bin\tizen.bat"
$Sdb = "C:\tizen-studio\tools\sdb.exe"
if (-not (Test-Path $Tizen)) { throw "Tizen CLI not found at $Tizen" }

$AppId = "Story0Time.StoryTimeUniverse"
$WgtName = "StoryTimeUniverse.wgt"

Write-Host "==> App ID: $AppId (package Story0Time = 10 chars)" -ForegroundColor Cyan
Write-Host "==> Cleaning previous build..." -ForegroundColor Cyan
if (Test-Path ".buildResult") {
    try {
        Remove-Item ".buildResult" -Recurse -Force -ErrorAction Stop
    } catch {
        $bak = ".buildResult_old_{0}" -f (Get-Random)
        Rename-Item ".buildResult" $bak -ErrorAction SilentlyContinue
        Write-Host "    (old build folder locked; renamed to $bak)" -ForegroundColor DarkYellow
    }
}

Write-Host "==> Building (excluding .git, docs, scripts)..." -ForegroundColor Cyan
& $Tizen build-web `
    -e ".git/*" `
    -e ".git" `
    -e "README.md" `
    -e ".gitignore" `
    -e "scripts/*" `
    -e "scripts" `
    -e "*.md" `
    -e ".cursor/*" `
    -e ".cursor" `
    -- $Root
if ($LASTEXITCODE -ne 0) { throw "tizen build-web failed" }

Write-Host "==> Signing + packaging with profile '$Profile'..." -ForegroundColor Cyan
& $Tizen package -t wgt -s $Profile -- "$Root\.buildResult"
if ($LASTEXITCODE -ne 0) { throw "tizen package failed" }

# Tizen names the .wgt from <name>, which has spaces — rename for CLI installs.
$spaced = Get-ChildItem "$Root\.buildResult\*.wgt" | Select-Object -First 1
if (-not $spaced) { throw "No .wgt produced in .buildResult" }
$dest = Join-Path $Root $WgtName
if (Test-Path $dest) { Remove-Item $dest -Force }
Copy-Item $spaced.FullName $dest -Force
# Also keep a space-free copy inside .buildResult for Device Manager / sdb paths.
$cleanBuild = Join-Path $Root ".buildResult\$WgtName"
Copy-Item $spaced.FullName $cleanBuild -Force

Write-Host "==> Packaged: $dest ($([math]::Round((Get-Item $dest).Length/1KB)) KB)" -ForegroundColor Green
Write-Host "    Application ID: $AppId" -ForegroundColor Green

if ($Target) {
    Write-Host "==> Installing on $Target ..." -ForegroundColor Cyan
    & $Sdb -s $Target shell 0 vd_appuninstall $AppId 2>$null | Out-Null
    & $Tizen install -n $WgtName -t $Target -- $Root
    if ($LASTEXITCODE -ne 0) { throw "tizen install failed" }
    Write-Host "==> Installed. Launch with Device Manager or:" -ForegroundColor Green
    Write-Host "    sdb -s $Target shell 0 was_execute $AppId" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Start emulator / connect TV in Device Manager"
    Write-Host "  2. Right-click device -> Permit to install applications"
    Write-Host "  3. .\scripts\package.ps1 -Target emulator-26101"
    Write-Host "     or: tizen install -n $WgtName -t <device>"
}
