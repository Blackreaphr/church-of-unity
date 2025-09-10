param(
  [string]$Root = ".",
  [int]$Port = 5173,
  [switch]$Open,
  [switch]$Live
)

try {
  $Root = (Resolve-Path -LiteralPath $Root).Path
} catch {
  Write-Error "Root path not found: $Root"
  exit 1
}

Write-Host "Serving $Root at http://127.0.0.1:$Port/ (Ctrl+C to stop)"

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

if ($Open) {
  try { Start-Process "http://127.0.0.1:$Port/" | Out-Null } catch {}
}

# Live reload state (optional)
if ($Live) {
  $script:LR_Version = [DateTime]::UtcNow.Ticks
  $script:LR_Ext = @('.html','.htm','.css','.js','.mjs','.json','.svg','.png','.jpg','.jpeg','.webmanifest')
  try {
    $fsw = New-Object System.IO.FileSystemWatcher $Root
    $fsw.IncludeSubdirectories = $true
    $fsw.EnableRaisingEvents = $true
    $handler = {
      param($s,$e)
      try {
        $ext = [System.IO.Path]::GetExtension($e.FullPath)
        if ($script:LR_Ext -contains $ext.ToLowerInvariant()) {
          $script:LR_Version = [DateTime]::UtcNow.Ticks
        }
      } catch {}
    }
    $fsw.add_Changed($handler)
    $fsw.add_Created($handler)
    $fsw.add_Deleted($handler)
    $fsw.add_Renamed([System.IO.RenamedEventHandler]{ param($s,$e) $script:LR_Version = [DateTime]::UtcNow.Ticks })
    $script:_fsw = $fsw
  } catch {}
}

function Get-ContentType([string]$path) {
  $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  switch ($ext) {
    ".html" { return "text/html; charset=utf-8" }
    ".htm"  { return "text/html; charset=utf-8" }
    ".css"  { return "text/css; charset=utf-8" }
    ".js"   { return "application/javascript; charset=utf-8" }
    ".mjs"  { return "application/javascript; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".svg"  { return "image/svg+xml" }
    ".png"  { return "image/png" }
    ".jpg"  { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".ico"  { return "image/x-icon" }
    ".webmanifest" { return "application/manifest+json" }
    default { return "application/octet-stream" }
  }
}

function Send-Response($stream, [int]$status, [string]$statusText, [string]$ctype, [byte[]]$body) {
  $sb = [System.Text.StringBuilder]::new()
  $null = $sb.Append("HTTP/1.1 $status $statusText`r`n")
  if ($ctype) { $null = $sb.Append("Content-Type: $ctype`r`n") }
  $len = if ($body) { $body.Length } else { 0 }
  $null = $sb.Append("Content-Length: $len`r`n")
  $null = $sb.Append("Cache-Control: no-cache`r`n")
  $null = $sb.Append("Connection: close`r`n`r`n")
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($sb.ToString())
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($body -and $len -gt 0) { $stream.Write($body, 0, $len) }
}

trap [System.Exception] { continue }

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)

    # Request line
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { $client.Close(); continue }
    $parts = $requestLine -split ' '
    if ($parts.Count -lt 2) {
      Send-Response $stream 400 "Bad Request" "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Bad Request"))
      $client.Close(); continue
    }
    $method = $parts[0]
    $url = $parts[1]

    # Consume headers
    while ($true) {
      $h = $reader.ReadLine()
      if ($null -eq $h -or $h -eq "") { break }
    }

    if ($method -ne "GET" -and $method -ne "HEAD") {
      Send-Response $stream 405 "Method Not Allowed" "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Method Not Allowed"))
      $client.Close(); continue
    }

    $path = [Uri]::UnescapeDataString(($url.Split('?')[0]))
    if ([string]::IsNullOrWhiteSpace($path) -or $path -eq "/") { $path = "/index.html" }
    if ($path.Contains("..")) {
      Send-Response $stream 400 "Bad Request" "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Bad Path"))
      $client.Close(); continue
    }

    # Live reload check endpoint
    if ($Live -and $path -eq "/__lr-check") {
      $ver = "$script:LR_Version"
      $bytes = [Text.Encoding]::UTF8.GetBytes($ver)
      Send-Response $stream 200 "OK" "text/plain; charset=utf-8" $bytes
      $client.Close(); continue
    }

    $fsPath = Join-Path $Root ($path.TrimStart('/') -replace '/', '\\')
    if (Test-Path $fsPath -PathType Container) { $fsPath = Join-Path $fsPath "index.html" }
    if (-not (Test-Path $fsPath -PathType Leaf)) {
      Send-Response $stream 404 "Not Found" "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Not Found"))
      $client.Close(); continue
    }

    $ctype = Get-ContentType $fsPath
    $body = $null
    if ($method -eq "GET") {
      $body = [System.IO.File]::ReadAllBytes($fsPath)
      if ($Live -and $ctype -like "text/html*") {
        try {
          $html = [Text.Encoding]::UTF8.GetString($body)
          $snippet = @"
<script>
  (function(){
    var v = null;
    function check(){
      fetch('/__lr-check', { cache: 'no-store' }).then(function(r){ return r.text(); }).then(function(t){
        if (v === null) { v = t; }
        else if (t !== v) { location.reload(); }
      }).catch(function(){}).finally(function(){ setTimeout(check, 800); });
    }
    setTimeout(check, 800);
  })();
</script>
"@
          $inserted = $false
          $idx = $html.LastIndexOf('</body>', [System.StringComparison]::OrdinalIgnoreCase)
          if ($idx -ge 0) {
            $html = $html.Insert($idx, $snippet)
            $inserted = $true
          }
          if (-not $inserted) {
            $idx = $html.LastIndexOf('</html>', [System.StringComparison]::OrdinalIgnoreCase)
            if ($idx -ge 0) { $html = $html.Insert($idx, $snippet); $inserted = $true }
          }
          if (-not $inserted) { $html += $snippet }
          $body = [Text.Encoding]::UTF8.GetBytes($html)
        } catch {}
      }
    }
    Send-Response $stream 200 "OK" $ctype $body
  } catch {
    # ignore per-connection errors
  } finally {
    try { $client.Close() } catch {}
  }
}
