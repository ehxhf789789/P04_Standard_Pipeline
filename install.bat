@echo off
setlocal enabledelayedexpansion
title BIM-Vortex Installer

echo.
echo  ============================================
echo       BIM-Vortex Installer
echo       AI Standards Pipeline
echo  ============================================
echo.

:: ============================================
:: 1. Python check + auto install
:: ============================================
set PYTHON_CMD=python
set PYTHON_OK=0

python --version >nul 2>&1
if errorlevel 1 goto :python_missing

:: Parse version
for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PV=%%v
for /f "tokens=1,2 delims=." %%a in ("!PV!") do (
    if %%a GEQ 3 if %%b GEQ 11 set PYTHON_OK=1
)

if "!PYTHON_OK!"=="1" (
    echo  [OK] Python found: !PV!
    goto :python_done
)

echo  [WARN] Python !PV! found but 3.11+ required.

:python_missing
echo  [INFO] Installing Python 3.11.9 automatically...
echo.

set PYTHON_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
set PYTHON_INSTALLER=%TEMP%\python-3.11.9-amd64.exe

echo  Downloading Python 3.11.9...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '!PYTHON_URL!' -OutFile '!PYTHON_INSTALLER!' -UseBasicParsing" 2>nul

if not exist "!PYTHON_INSTALLER!" (
    echo  [ERROR] Download failed.
    echo  Please install Python 3.11+ manually: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo  Installing Python 3.11.9 ...
"!PYTHON_INSTALLER!" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_launcher=1

if errorlevel 1 (
    echo  [WARN] Silent install issue. Trying interactive...
    "!PYTHON_INSTALLER!" PrependPath=1 Include_pip=1
)

:: Refresh PATH
set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%PATH%"

python --version >nul 2>&1
if errorlevel 1 (
    py -3 --version >nul 2>&1
    if errorlevel 1 (
        echo  [ERROR] Python install failed. Restart terminal and retry.
        pause
        exit /b 1
    )
    set PYTHON_CMD=py -3
    echo  [OK] Python installed (py launcher)
    py -3 --version
) else (
    echo  [OK] Python installed
    python --version
)

del "!PYTHON_INSTALLER!" >nul 2>&1

:python_done

:: ============================================
:: 2. Node.js check + auto install
:: ============================================
node --version >nul 2>&1
if not errorlevel 1 (
    echo  [OK] Node.js found
    node --version
    goto :node_done
)

echo  [INFO] Installing Node.js 20.18.0 LTS automatically...
echo.

set NODE_URL=https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi
set NODE_INSTALLER=%TEMP%\node-v20.18.0-x64.msi

echo  Downloading Node.js 20.18.0...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%' -UseBasicParsing" 2>nul

if not exist "%NODE_INSTALLER%" (
    echo  [ERROR] Download failed.
    echo  Please install Node.js 20+ manually: https://nodejs.org/
    pause
    exit /b 1
)

echo  Installing Node.js 20.18.0 ...
msiexec /i "%NODE_INSTALLER%" /qn /norestart

if errorlevel 1 (
    echo  [WARN] Silent install issue. Trying interactive...
    msiexec /i "%NODE_INSTALLER%"
)

set "PATH=C:\Program Files\nodejs;%PATH%"

node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js install failed. Restart terminal and retry.
    pause
    exit /b 1
)

echo  [OK] Node.js installed
node --version
del "%NODE_INSTALLER%" >nul 2>&1

:node_done

:: ============================================
:: 3. Python packages
:: ============================================
echo.
echo  [1/4] Installing Python dependencies...
cd /d "%~dp0apps\backend"
!PYTHON_CMD! -m pip install --upgrade pip >nul 2>&1
!PYTHON_CMD! -m pip install fastapi uvicorn python-multipart pydantic pydantic-settings python-jose aiofiles sqlalchemy aiosqlite httpx PyMuPDF python-docx openpyxl python-pptx lxml olefile 2>&1 | findstr /i "successfully already"
if errorlevel 1 echo  (Some packages may have been skipped)

:: ============================================
:: 4. Node.js packages
:: ============================================
echo.
echo  [2/4] Installing Node.js dependencies...
cd /d "%~dp0"
call npm install 2>&1 | findstr /i "added up"

:: ============================================
:: 5. WASM files
:: ============================================
echo.
echo  [3/4] Copying WASM files...
if not exist "apps\frontend\public\wasm" mkdir "apps\frontend\public\wasm"
if exist "node_modules\web-ifc\web-ifc.wasm" (
    copy /Y "node_modules\web-ifc\web-ifc.wasm" "apps\frontend\public\wasm\web-ifc.wasm" >nul
    echo  [OK] WASM files copied
) else (
    if exist "apps\frontend\node_modules\web-ifc\web-ifc.wasm" (
        copy /Y "apps\frontend\node_modules\web-ifc\web-ifc.wasm" "apps\frontend\public\wasm\web-ifc.wasm" >nul
        echo  [OK] WASM files copied from frontend
    ) else (
        echo  [SKIP] web-ifc WASM not found
    )
)

:: ============================================
:: 6. Upload directory
:: ============================================
echo.
echo  [4/4] Creating upload directory...
if not exist "apps\backend\uploads" mkdir "apps\backend\uploads"
echo  [OK] Upload directory ready

:: ============================================
:: Done
:: ============================================
echo.
echo  ============================================
echo   Installation complete!
echo.
echo   To start: run start.bat
echo   Demo login: demo@bim-vortex.com / demo1234
echo  ============================================
echo.

endlocal
pause
