@echo off
title BIM-Vortex

echo.
echo  ============================================
echo       BIM-Vortex
echo       AI Standards Pipeline
echo  ============================================
echo.

:: Detect python command
set PYTHON_CMD=python
python --version >nul 2>&1
if errorlevel 1 (
    py -3 --version >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=py -3
    ) else (
        echo  [ERROR] Python not found. Run install.bat first.
        pause
        exit /b 1
    )
)

:: Kill existing
echo  Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

:: Ensure upload dir exists
if not exist "%~dp0apps\backend\uploads" mkdir "%~dp0apps\backend\uploads"

echo  [1/3] Starting Backend...
cd /d "%~dp0apps\backend"
start "BIM-Vortex-Backend" /min cmd /c "title [Backend] :8000 && %PYTHON_CMD% -m uvicorn src.main:app --port 8000 --reload"

echo  [2/3] Starting Frontend...
cd /d "%~dp0apps\frontend"
start "BIM-Vortex-Frontend" /min cmd /c "title [Frontend] :3000 && npm run dev"

echo  [3/3] Creating demo account...
echo  Waiting for servers...
:wait_loop
timeout /t 2 /nobreak >nul
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 goto wait_loop

curl -s -X POST http://localhost:8000/api/v1/auth/register -H "Content-Type: application/json" -d "{\"email\":\"demo@bim-vortex.com\",\"password\":\"demo1234\",\"name\":\"Demo User\"}" >nul 2>&1

echo.
echo  ============================================
echo   BIM-Vortex is running!
echo.
echo   URL:     http://localhost:3000
echo   Login:   demo@bim-vortex.com / demo1234
echo   API:     http://localhost:8000/docs
echo.
echo   Demo Data: run demo-data.bat (optional)
echo   To stop:   run stop.bat or close this window
echo  ============================================
echo.

timeout /t 2 /nobreak >nul
start http://localhost:3000/login

echo  Press any key to stop all servers...
pause >nul

:: Cleanup
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
echo  Servers stopped.
timeout /t 2 /nobreak >nul
