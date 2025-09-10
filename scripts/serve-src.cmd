@echo off
setlocal
rem Serve project source with no installs
set PORT=%1
if "%PORT%"=="" set PORT=5173
set SCRIPT_DIR=%~dp0
set ROOT=%SCRIPT_DIR%..
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%serve.ps1" -Root "%ROOT%" -Port %PORT% -Open -Live
