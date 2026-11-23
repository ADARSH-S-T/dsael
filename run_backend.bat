@echo off
title LabFlow - Python Flask API Server (Port 5001)
cd /d "%~dp0backend"
echo Checking Python environment...
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not found in PATH. Please install Python 3.10+ and add to PATH.
    pause
    exit /b 1
)
echo Starting LabFlow Python Flask API Server on port 5001...
python server.py
pause
