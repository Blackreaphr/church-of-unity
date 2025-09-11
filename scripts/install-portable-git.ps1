param(
  [string]$ExePath = "tools/PortableGit.7z.exe",
  [string]$DestDir = "tools/PortableGit"
)

$ErrorActionPreference = 'Stop'

$exe = Join-Path (Get-Location) $ExePath
$dest = Join-Path (Get-Location) $DestDir

if (!(Test-Path $exe)) { throw "PortableGit archive not found: $exe" }
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }

# Use Start-Process to avoid PowerShell quoting issues for 7z SFX flags
$args = @('-y', "-o$dest")
$p = Start-Process -FilePath $exe -ArgumentList $args -PassThru -Wait
if ($p.ExitCode -ne 0) { throw "Extraction failed with code $($p.ExitCode)" }

$git = Join-Path $dest 'cmd/git.exe'
if (!(Test-Path $git)) { throw "git.exe not found after extraction at $git" }

Write-Output $git

