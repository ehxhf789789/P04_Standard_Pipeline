@echo off
chcp 65001 >nul
title BIM-Vortex

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║         BIM-Vortex                       ║
echo  ║         AI Standards Pipeline            ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Kill existing processes
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo  [1/3] Starting Backend...
cd /d "%~dp0apps\backend"
start "BIM-Vortex-Backend" /min cmd /c "title [Backend] :8000 && python -m uvicorn src.main:app --port 8000 --reload"

echo  [2/3] Starting Frontend...
cd /d "%~dp0apps\frontend"
start "BIM-Vortex-Frontend" /min cmd /c "title [Frontend] :3000 && npm run dev"

echo  [3/3] Creating demo account...
timeout /t 5 /nobreak >nul
curl -s -X POST http://localhost:8000/api/v1/auth/register -H "Content-Type: application/json" -d "{\"email\":\"demo@bim-vortex.com\",\"password\":\"demo1234\",\"name\":\"Demo User\"}" >nul 2>&1

echo.
echo  ============================================
echo   Ready!
echo   URL:     http://localhost:3000
echo   Login:   demo@bim-vortex.com / demo1234
echo  ============================================
echo.

timeout /t 3 /nobreak >nul
start http://localhost:3000/login

echo  Press any key to exit this window...
pause >nul
