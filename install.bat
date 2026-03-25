@echo off
chcp 65001 >nul
title BIM-Vortex Installer

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║      BIM-Vortex Installer                ║
echo  ║      AI Standards Pipeline               ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python is not installed!
    echo  Please install Python 3.11+ from https://www.python.org/downloads/
    pause
    exit /b 1
)
echo  [OK] Python found
python --version

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js is not installed!
    echo  Please install Node.js 20+ from https://nodejs.org/
    pause
    exit /b 1
)
echo  [OK] Node.js found
node --version

echo.
echo  [1/3] Installing Python dependencies...
cd /d "%~dp0apps\backend"
pip install fastapi uvicorn python-multipart pydantic pydantic-settings python-jose aiofiles sqlalchemy aiosqlite httpx PyMuPDF python-docx openpyxl python-pptx lxml olefile 2>&1 | findstr /i "successfully already"
if errorlevel 1 echo  (Some packages may have been skipped)

echo.
echo  [2/3] Installing Node.js dependencies...
cd /d "%~dp0"
call npm install 2>&1 | findstr /i "added up"

echo.
echo  [3/3] Copying WASM files...
if exist "node_modules\web-ifc\web-ifc.wasm" (
    copy /Y "node_modules\web-ifc\web-ifc.wasm" "apps\frontend\public\wasm\web-ifc.wasm" >nul
    echo  [OK] WASM files copied
) else (
    echo  [SKIP] web-ifc WASM not found
)

echo.
echo  ============================================
echo   Installation complete!
echo.
echo   To start: run start.bat
echo   Demo login: demo@bim-vortex.com / demo1234
echo  ============================================
echo.
pause
