@echo off
title LabFlow - Smart Laboratory Test Management System
color 0B

echo ======================================================================
echo    LABFLOW - SMART LABORATORY TEST MANAGEMENT SYSTEM
echo ======================================================================
echo.

:: Detect root directory
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

echo [1/4] Checking Python and Node.js environments...
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not found in PATH. Please install Python 3.10+ and add to PATH.
    pause
    exit /b 1
)

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH. Please install Node.js 18+ and add to PATH.
    pause
    exit /b 1
)

echo [OK] Python and Node.js detected.
echo.

echo [2/4] Starting LabFlow Python Flask Backend API (Port 5001)...
start "LabFlow Backend (Flask:5001)" cmd /k "cd /d ""%ROOT_DIR%backend"" && echo Starting Flask Backend... && python server.py"

:: Wait 3 seconds for backend server socket to bind
timeout /t 3 /nobreak >nul

echo [3/4] Starting LabFlow React Vite Frontend (Port 3000)...
start "LabFlow Frontend (React:3000)" cmd /k "cd /d ""%ROOT_DIR%frontend"" && echo Starting Frontend... && npm run dev"

:: Wait 3 seconds for Vite server to initialize
timeout /t 3 /nobreak >nul

echo [4/4] Opening LabFlow in your default browser...
start http://localhost:3000

echo.
echo ======================================================================
echo    SYSTEM IS NOW RUNNING!
echo    - Frontend UI:  http://localhost:3000
echo    - Backend API:  http://127.0.0.1:5001
echo    - API Health:   http://127.0.0.1:5001/api/health
echo.
echo    To stop the servers, simply close the two opened terminal windows.
echo ======================================================================
echo.
pause
