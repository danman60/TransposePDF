@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo TransposePDF setup is incomplete: .venv is missing.
  pause
  exit /b 1
)
start "TransposePDF Server" /min ".venv\Scripts\python.exe" server.py
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000"
