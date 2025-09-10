@echo off
setlocal
rem Serve built files from dist
set PORT=%1
if "%PORT%"=="" set PORT=8080
set SCRIPT_DIR=%~dp0
set ROOT=%SCRIPT_DIR%..\dist
if not exist "%ROOT%" (
  echo dist folder not found at "%ROOT%"
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%serve.ps1" -Root "%ROOT%" -Port %PORT% -Open -Live
