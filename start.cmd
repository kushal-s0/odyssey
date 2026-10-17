@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Install dependencies using the README setup first.
  exit /b 1
)
".venv\Scripts\python.exe" -B scripts\dev.py %*
