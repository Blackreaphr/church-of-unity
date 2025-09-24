# Deploy to Hostinger (SFTP)
#
# Usage (PowerShell):
#   ./scripts/deploy.ps1               # build + deploy
#   ./scripts/deploy.ps1 -SkipBuild    # deploy using existing dist/
#   ./scripts/deploy.ps1 -DryRun       # list files that would upload
#   ./scripts/deploy.ps1 -Clean        # clean remote dir before upload
#
# What it does:
# - Builds the site with a stamped version (vite + stamp script)
# - Uploads dist/ to Hostinger via SFTP using a private key
#
# Hostinger target:
#   host: 82.198.232.46  port: 65002
#   user: u558531826     key: $HOME\.ssh\id_ed25519
#   dest: domains/thechurchofunity.com/public_html

[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [switch]$DryRun,
  [switch]$Clean
)

Write-Host "== Deploy: Hostinger (SFTP) ==" -ForegroundColor Cyan

# Ensure required tools
function Assert-Cmd($name){
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)){
    throw "Required command not found: $name"
  }
}
Assert-Cmd npm
Assert-Cmd node

# Environment for scripts/deploy-sftp.mjs
$env:DEPLOY_HOST = '82.198.232.46'
$env:DEPLOY_PORT = '65002'
$env:DEPLOY_USER = 'u558531826'
$env:DEPLOY_KEY  = Join-Path $HOME '.ssh/id_ed25519'
$env:DEPLOY_DEST = 'domains/thechurchofunity.com/public_html'
$env:DEPLOY_DRY_RUN = if ($DryRun) { '1' } else { '0' }
$env:DEPLOY_CLEAN   = if ($Clean) { '1' } else { '0' }

Write-Host ("Target: $($env:DEPLOY_USER)@$($env:DEPLOY_HOST):$($env:DEPLOY_PORT)") -ForegroundColor DarkGray
Write-Host ("Key:    $($env:DEPLOY_KEY)") -ForegroundColor DarkGray
Write-Host ("Dest:   $($env:DEPLOY_DEST)") -ForegroundColor DarkGray
if ($DryRun) { Write-Host "Mode:   DRY RUN" -ForegroundColor Yellow }
if ($Clean)  { Write-Host "Mode:   CLEAN REMOTE" -ForegroundColor Yellow }

if (-not (Test-Path $env:DEPLOY_KEY)){
  Write-Warning "Private key not found at $($env:DEPLOY_KEY). Continuing (password auth may be required)."
}

if (-not $SkipBuild){
  Write-Host "-- Building (vite + stamp) --" -ForegroundColor Cyan
  npm run build:stamp
  if ($LASTEXITCODE -ne 0){ throw "Build failed" }
  try {
    Write-Host "-- Generating PNG icons (192,512) --" -ForegroundColor Cyan
    node scripts/generate-icons.mjs 192 512 | Write-Output
  } catch { Write-Warning "Icon generation failed (continuing): $($_.Exception.Message)" }
} else {
  Write-Host "-- Skipping build as requested --" -ForegroundColor Yellow
}

# Ensure stamped webmanifest is available at site root (HTML references /site-*.webmanifest)
try {
  Write-Host "-- Preparing webmanifest at dist root --" -ForegroundColor Cyan
  $mf = Get-ChildItem -Path (Join-Path $PWD 'dist/assets') -Filter 'site-*.webmanifest' -ErrorAction SilentlyContinue
  if ($mf) {
    foreach ($m in $mf) {
      Copy-Item -Force $m.FullName (Join-Path (Join-Path $PWD 'dist') $m.Name)
      Write-Host ("Copied manifest: {0} -> dist/{1}" -f $m.Name, $m.Name) -ForegroundColor DarkGray
    }
  } else {
    Write-Host "No stamped webmanifest found under dist/assets (skipping)" -ForegroundColor DarkGray
  }
} catch { Write-Warning "Could not prepare webmanifest: $($_.Exception.Message)" }

# Ensure non-hashed symbol.svg exists at /assets for manifest icons
try {
  $srcSymbol = Join-Path $PWD 'assets/symbol.svg'
  $dstSymbolDir = Join-Path $PWD 'dist/assets'
  $dstSymbol = Join-Path $dstSymbolDir 'symbol.svg'
  if (Test-Path $srcSymbol) {
    if (-not (Test-Path $dstSymbolDir)) { New-Item -ItemType Directory -Path $dstSymbolDir | Out-Null }
    Copy-Item -Force $srcSymbol $dstSymbol
    Write-Host "Copied icon: assets/symbol.svg -> dist/assets/symbol.svg" -ForegroundColor DarkGray
  } else {
    Write-Host "Note: assets/symbol.svg not found (skipping icon copy)" -ForegroundColor DarkGray
  }
} catch { Write-Warning "Could not copy symbol.svg: $($_.Exception.Message)" }

# Ensure PNG icon variants are present for PWA manifest
try {
  $pngs = Get-ChildItem -Path (Join-Path $PWD 'assets') -Filter 'symbol-*.png' -ErrorAction SilentlyContinue
  if ($pngs) {
    if (-not (Test-Path $dstSymbolDir)) { New-Item -ItemType Directory -Path $dstSymbolDir | Out-Null }
    foreach ($p in $pngs) {
      Copy-Item -Force $p.FullName (Join-Path $dstSymbolDir $p.Name)
      Write-Host ("Copied icon: assets/{0} -> dist/assets/{0}" -f $p.Name) -ForegroundColor DarkGray
    }
    # Ensure a physical favicon.ico exists at dist root for maximal compatibility
    $icoSrc = Join-Path $dstSymbolDir 'symbol-32.png'
    $icoDst = Join-Path (Join-Path $PWD 'dist') 'favicon.ico'
    if (Test-Path $icoSrc) {
      Copy-Item -Force $icoSrc $icoDst
      Write-Host "Created dist/favicon.ico from dist/assets/symbol-32.png" -ForegroundColor DarkGray
    }
  } else {
    Write-Host "Note: No PNG icons found under assets/ (skipping)" -ForegroundColor DarkGray
  }
} catch { Write-Warning "Could not copy PNG icons: $($_.Exception.Message)" }

# Provide stable fallbacks for dynamic chunks and site modules
try {
  # Ensure /stats.js exists (fallback target in .htaccess)
  $srcStats = Join-Path $PWD 'stats.js'
  $dstStats = Join-Path $PWD 'dist/stats.js'
  if (Test-Path $srcStats) {
    Copy-Item -Force $srcStats $dstStats
    Write-Host "Copied: stats.js -> dist/stats.js" -ForegroundColor DarkGray
  }
  # Copy /site/* to dist/site so stable module paths exist (meta.js, stats.js, forum.js)
  $srcSite = Join-Path $PWD 'site'
  $dstSite = Join-Path $PWD 'dist/site'
  if (Test-Path $srcSite) {
    if (-not (Test-Path $dstSite)) { New-Item -ItemType Directory -Path $dstSite | Out-Null }
    Copy-Item -Force -Recurse -Path (Join-Path $srcSite '*') -Destination $dstSite
    Write-Host "Copied: site/* -> dist/site/" -ForegroundColor DarkGray
  }
} catch { Write-Warning "Could not copy back-compat modules: $($_.Exception.Message)" }

Write-Host "-- Normalizing remote permissions (assets, forum, forum-feed, site, dist) --" -ForegroundColor Cyan
try {
  $remoteCmd = @(
    'BASE=''' + $env:DEPLOY_DEST + ''';',
    'if [ -d "$BASE" ]; then',
    '  for d in assets forum forum-feed site public_assets dist; do',
    '    if [ -d "$BASE/$d" ]; then',
    '      chmod -R u+rwX "$BASE/$d" 2>/dev/null || true;',
    '      find "$BASE/$d" -type d -exec chmod 755 {} \; 2>/dev/null || true;',
    '      find "$BASE/$d" -type f -exec chmod 644 {} \; 2>/dev/null || true;',
    '    fi',
    '  done',
    'fi'
  ) -join ' '
  & ssh -p $env:DEPLOY_PORT -i $env:DEPLOY_KEY -o StrictHostKeyChecking=no -o IdentitiesOnly=yes ("{0}@{1}" -f $env:DEPLOY_USER, $env:DEPLOY_HOST) $remoteCmd
} catch {
  Write-Warning "Could not normalize remote permissions (continuing): $($_.Exception.Message)"
}

Write-Host "-- Deploying via SFTP --" -ForegroundColor Cyan
npm run deploy:hostinger
if ($LASTEXITCODE -ne 0){ throw "Deploy failed" }

Write-Host "-- Finalizing remote permissions (assets, forum, forum-feed, site, dist) --" -ForegroundColor Cyan
try {
  $remoteCmd2 = @(
    'BASE=''' + $env:DEPLOY_DEST + ''';',
    'if [ -d "$BASE" ]; then',
    '  for d in assets forum forum-feed site public_assets dist; do',
    '    if [ -d "$BASE/$d" ]; then',
    '      find "$BASE/$d" -type d -exec chmod 755 {} \; 2>/dev/null || true;',
    '      find "$BASE/$d" -type f -exec chmod 644 {} \; 2>/dev/null || true;',
    '    fi',
    '  done',
    'fi'
  ) -join ' '
  & ssh -p $env:DEPLOY_PORT -i $env:DEPLOY_KEY -o StrictHostKeyChecking=no -o IdentitiesOnly=yes ("{0}@{1}" -f $env:DEPLOY_USER, $env:DEPLOY_HOST) $remoteCmd2
} catch {
  Write-Warning "Could not finalize remote permissions (continuing): $($_.Exception.Message)"
}

Write-Host "Done. Live site updated." -ForegroundColor Green

