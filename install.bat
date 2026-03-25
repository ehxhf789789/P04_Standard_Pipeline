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
echo  [1/4] Installing Python dependencies...
cd /d "%~dp0apps\backend"
pip install fastapi uvicorn python-multipart pydantic pydantic-settings python-jose aiofiles sqlalchemy aiosqlite httpx PyMuPDF python-docx openpyxl python-pptx lxml olefile 2>&1 | findstr /i "successfully already"
if errorlevel 1 echo  (Some packages may have been skipped)

echo.
echo  [2/4] Installing Node.js dependencies...
cd /d "%~dp0"
call npm install 2>&1 | findstr /i "added up"

echo.
echo  [3/4] Copying WASM files...
if not exist "apps\frontend\public\wasm" mkdir "apps\frontend\public\wasm"
if exist "node_modules\web-ifc\web-ifc.wasm" (
    copy /Y "node_modules\web-ifc\web-ifc.wasm" "apps\frontend\public\wasm\web-ifc.wasm" >nul
    echo  [OK] WASM files copied
) else (
    :: Try apps/frontend node_modules
    if exist "apps\frontend\node_modules\web-ifc\web-ifc.wasm" (
        copy /Y "apps\frontend\node_modules\web-ifc\web-ifc.wasm" "apps\frontend\public\wasm\web-ifc.wasm" >nul
        echo  [OK] WASM files copied from frontend node_modules
    ) else (
        echo  [SKIP] web-ifc WASM not found - IFC 3D viewer will use fallback
    )
)

echo.
echo  [4/4] Creating upload directory...
if not exist "apps\backend\uploads" mkdir "apps\backend\uploads"
echo  [OK] Upload directory ready

echo.
echo  ============================================
echo   Installation complete!
echo.
echo   To start: run start.bat
echo   Demo login: demo@bim-vortex.com / demo1234
echo  ============================================
echo.
pause
