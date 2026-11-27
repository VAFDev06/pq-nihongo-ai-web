@echo off
title PQ Nihongo - Private Shadowing AI Model Server
echo ========================================================
echo   KHOI DONG PRIVATE SHADOWING AI MODEL SERVER (Port 8001)
echo   Qwen3-ASR-0.6B + Qwen3-ForcedAligner-0.6B + hatsuon + F0
echo ========================================================
cd /d "%~dp0ai-shadowing"

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Chua tim thay virtual environment tai ai-shadowing\.venv
    echo Vui long xem ai-shadowing\README.md de cai dat moi truong Python.
    pause
    exit /b 1
)

if "%HF_HOME%"=="" set "HF_HOME=%~dp0ai-shadowing\.cache\huggingface"
if "%HATSUON_MODEL_DIR%"=="" set "HATSUON_MODEL_DIR=%~dp0ai-shadowing\.cache\hatsuon"
set "TMP=%~dp0ai-shadowing\.cache\tmp"
set "TEMP=%~dp0ai-shadowing\.cache\tmp"
if not exist "%TMP%" mkdir "%TMP%" >nul 2>&1
if "%SHADOWING_PRELOAD_MODELS%"=="" set "SHADOWING_PRELOAD_MODELS=true"
set "PYTHONIOENCODING=utf-8"

echo HF_HOME=%HF_HOME%
echo HATSUON_MODEL_DIR=%HATSUON_MODEL_DIR%
echo SHADOWING_PRELOAD_MODELS=%SHADOWING_PRELOAD_MODELS%
echo Dang nap model va chay server noi bo tai http://127.0.0.1:8001 ...

".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 1
pause
