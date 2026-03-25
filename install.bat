@echo off
title BIM-Vortex Installer

echo.
echo  ============================================
echo       BIM-Vortex Installer
echo       AI Standards Pipeline
echo  ============================================
echo.

set ROOT=%~dp0
set PYDIR=%ROOT%tools\python
set PYCMD=%PYDIR%\python.exe

:: ============================================
:: 1. Extract bundled Python 3.11.9
:: ============================================
if exist "%PYCMD%" (
    echo  [OK] Bundled Python already extracted
    "%PYCMD%" --version
    goto :python_ready
)

echo  [1/5] Extracting bundled Python 3.11.9...
if not exist "%ROOT%tools\python311.zip" (
    echo  [ERROR] tools\python311.zip not found!
    echo  Please re-clone the repository.
    pause
    exit /b 1
)

powershell -Command "Expand-Archive -Path '%ROOT%tools\python311.zip' -DestinationPath '%PYDIR%' -Force"

if not exist "%PYCMD%" (
    echo  [ERROR] Python extraction failed.
    pause
    exit /b 1
)

echo  [OK] Python 3.11.9 extracted
"%PYCMD%" --version

:python_ready

:: ============================================
:: 2. Check Node.js
:: ============================================
node --version >/dev/null 2>&1
if not errorlevel 1 (
    echo  [OK] Node.js found
    node --version
    goto :node_ready
)

echo  [2/5] Node.js not found. Installing...
set NODE_URL=https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi
set NODE_INSTALLER=%TEMP%\node-v20.18.0-x64.msi

echo  Downloading Node.js 20.18.0...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%' -UseBasicParsing"

if not exist "%NODE_INSTALLER%" (
    echo  [ERROR] Download failed.
    echo  Please install Node.js 20+ from https://nodejs.org/
    pause
    exit /b 1
)

echo  Installing Node.js 20.18.0...
msiexec /i "%NODE_INSTALLER%" /qn /norestart
set "PATH=C:\Program Files\nodejs;%PATH%"

node --version >/dev/null 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js install failed. Try manually: https://nodejs.org/
    pause
    exit /b 1
)
echo  [OK] Node.js installed
del "%NODE_INSTALLER%" >/dev/null 2>&1

:node_ready

:: ============================================
:: 3. Python dependencies
:: ============================================
echo.
echo  [3/5] Installing Python dependencies...
cd /d "%ROOT%apps\backend"
"%PYCMD%" -m pip install --upgrade pip >/dev/null 2>&1
"%PYCMD%" -m pip install fastapi uvicorn python-multipart pydantic pydantic-settings python-jose aiofiles sqlalchemy aiosqlite httpx PyMuPDF python-docx openpyxl python-pptx lxml olefile

:: ============================================
:: 4. Node.js dependencies
:: ============================================
echo.
echo  [4/5] Installing Node.js dependencies...
cd /d "%ROOT%"
call npm install

:: ============================================
:: 5. WASM + uploads
:: ============================================
echo.
echo  [5/5] Setup...
if not exist "apps\frontend\public\wasm" mkdir "apps\frontend\public\wasm"
if exist "node_modules\web-ifc\web-ifc.wasm" (
    copy /Y "node_modules\web-ifc\web-ifc.wasm" "apps\frontend\public\wasm\web-ifc.wasm" >nul
    echo  [OK] WASM copied
) else (
    if exist "apps\frontend\node_modules\web-ifc\web-ifc.wasm" (
        copy /Y "apps\frontend\node_modules\web-ifc\web-ifc.wasm" "apps\frontend\public\wasm\web-ifc.wasm" >nul
        echo  [OK] WASM copied
    ) else (
        echo  [SKIP] WASM not found
    )
)
if not exist "apps\backend\uploads" mkdir "apps\backend\uploads"

echo.
echo  ============================================
echo   Installation complete!
echo.
echo   To start: run start.bat
echo   Login: demo@bim-vortex.com / demo1234
echo  ============================================
echo.
pause