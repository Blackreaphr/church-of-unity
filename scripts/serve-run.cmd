@echo off
setlocal
rem Launches the dev server in its own window if not already running
set PORT=%1
if "%PORT%"=="" set PORT=5173
set SCRIPT_DIR=%~dp0

rem Test if port is listening
powershell -NoProfile -Command "try { $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', %PORT%); if($c.Connected){$c.Close();exit 0}else{exit 1} } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL%==0 (
  echo Server already running on http://127.0.0.1:%PORT%/
  start "Church of Unity" "http://127.0.0.1:%PORT%/"
  goto :eof
) else (
  echo Starting server on http://127.0.0.1:%PORT%/
  rem Run in the current terminal (no new window)
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%serve.ps1" -Root "%SCRIPT_DIR%.." -Port %PORT% -Open -Live
  goto :eof
)
