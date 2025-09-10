param(
  [Parameter(Mandatory=$true)][string]$Title,
  [string]$Slug,
  [string]$Date = (Get-Date -Format 'yyyy-MM-dd'),
  [string]$Category = '',
  [string]$Starter = '',
  [string[]]$Tags = @()
)

if (-not $Slug -or $Slug.Trim() -eq '') {
  $Slug = ($Title -replace '[^a-zA-Z0-9]+','-').Trim('-').ToLowerInvariant()
}

$root = Split-Path -Parent $PSScriptRoot
$postPath = Join-Path $root "forum/$Slug.html"
$indexPath = Join-Path $root 'data/forum-posts.json'

if (Test-Path $postPath) { Write-Error "Post already exists: $postPath"; exit 1 }
if (-not (Test-Path (Split-Path -Parent $postPath))) { New-Item -ItemType Directory -Force -Path (Split-Path -Parent $postPath) | Out-Null }

$html = @"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>$Title | Church of Unity</title>
    <meta name="description" content="" />
    <meta name="theme-color" content="#0b0c10" />
    <meta name="color-scheme" content="dark light" />
    <link rel="manifest" href="/site.webmanifest" />
    <link rel="stylesheet" href="/styles.css" />
    <script type="module" src="/site/meta.js"></script>
    <script type="module" src="/site/search.js"></script>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <canvas id="bgCanvas" aria-hidden="true"></canvas>
    <header class="hero">
      <div class="container hero-inner">
        <div class="hero-copy">
          <h1 class="site-title">$Title</h1>
          <p class="tagline">$Date</p>
        </div>
      </div>
    </header>
    <nav class="site-nav" aria-label="Primary">
      <div class="container nav-inner">
        <div class="nav-links">
          <a class="home" href="/index.html">Home</a>
          <a href="/forum.html">Back to Forum</a>
        </div>
        <div class="nav-right">
          <button id="navSearch" class="ghost" aria-label="Search" title="Search" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>
      </div>
    </nav>
    <main id="main" class="container">
      <article class="section dropcap">
        <p>Write here.</p>
      </article>
    </main>
    <footer class="footer container">
      <small>&copy; <span id="year"></span> Church of Unity</small>
    </footer>
    <script type="module" src="/main.js"></script>
  </body>
 </html>
"@

$html | Out-File -FilePath $postPath -Encoding UTF8 -Force

if (-not (Test-Path $indexPath)) {
  '{"posts":[]}' | Out-File -FilePath $indexPath -Encoding UTF8
}

$json = Get-Content -Raw -Path $indexPath | ConvertFrom-Json
if (-not $json.posts) { $json | Add-Member -NotePropertyName posts -NotePropertyValue @() }

$entry = [ordered]@{
  title = $Title
  url = "/forum/$Slug.html"
  date = $Date
  lastReplyAt = "$Date" + 'T00:00:00Z'
  starter = $Starter
  category = $Category
  replies = 0
  tags = $Tags
  excerpt = ""
}

$json.posts += $entry
$json | ConvertTo-Json -Depth 6 | Out-File -FilePath $indexPath -Encoding UTF8

Write-Host "Created: $postPath"
Write-Host "Indexed: $($entry.url)"
