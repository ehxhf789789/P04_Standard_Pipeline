@echo off
chcp 65001 >nul
title BIM-Vortex Installer

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║      BIM-Vortex Installer                ║
echo  ║      AI Standards Pipeline               ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ============================================
:: 1. Python 체크 및 자동 설치
:: ============================================
set PYTHON_OK=0
set PYTHON_CMD=python

:: python 명령 확인
python --version >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYTHON_VER=%%v
    for /f "tokens=1,2 delims=." %%a in ("!PYTHON_VER!") do (
        set PYTHON_MAJOR=%%a
        set PYTHON_MINOR=%%b
    )
)

:: enabledelayedexpansion 으로 버전 비교
setlocal enabledelayedexpansion

set PYTHON_OK=0

:: python 존재 여부 + 버전 체크
python --version >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PV=%%v
    for /f "tokens=1,2 delims=." %%a in ("!PV!") do (
        if %%a GEQ 3 if %%b GEQ 11 set PYTHON_OK=1
    )
)

if "!PYTHON_OK!"=="1" (
    echo  [OK] Python found: !PV!
) else (
    echo  [INFO] Python 3.11+ not found. Installing automatically...
    echo.

    :: Python 3.11.9 다운로드 (Windows 64-bit)
    set PYTHON_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
    set PYTHON_INSTALLER=%TEMP%\python-3.11.9-amd64.exe

    echo  Downloading Python 3.11.9...
    powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '!PYTHON_URL!' -OutFile '!PYTHON_INSTALLER!' -UseBasicParsing }" 2>nul

    if not exist "!PYTHON_INSTALLER!" (
        echo  [ERROR] Download failed.
        echo  Please manually install Python 3.11+ from https://www.python.org/downloads/
        pause
        exit /b 1
    )

    echo  Installing Python 3.11.9 (silent mode)...
    echo  - Add to PATH: Yes
    echo  - Install for all users: No (current user)
    echo.

    "!PYTHON_INSTALLER!" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_launcher=1

    if errorlevel 1 (
        echo  [WARN] Silent install returned error. Trying interactive install...
        "!PYTHON_INSTALLER!" PrependPath=1 Include_pip=1
    )

    :: 설치 후 PATH 갱신
    set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%PATH%"

    :: 재확인
    python --version >nul 2>&1
    if errorlevel 1 (
        :: py launcher 시도
        py -3.11 --version >nul 2>&1
        if errorlevel 1 (
            echo  [ERROR] Python installation failed.
            echo  Please restart this terminal and try again,
            echo  or manually install from https://www.python.org/downloads/
            pause
            exit /b 1
        ) else (
            set PYTHON_CMD=py -3.11
            echo  [OK] Python installed via py launcher
            py -3.11 --version
        )
    ) else (
        echo  [OK] Python installed successfully
        python --version
    )

    :: 임시 파일 정리
    del "!PYTHON_INSTALLER!" >nul 2>&1
)

endlocal & set PYTHON_CMD=%PYTHON_CMD%

:: ============================================
:: 2. Node.js 체크 및 자동 설치
:: ============================================
node --version >nul 2>&1
if errorlevel 1 (
    echo  [INFO] Node.js not found. Installing automatically...
    echo.

    set NODE_URL=https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi
    set NODE_INSTALLER=%TEMP%\node-v20.18.0-x64.msi

    echo  Downloading Node.js 20.18.0 LTS...
    powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%' -UseBasicParsing }" 2>nul

    if not exist "%NODE_INSTALLER%" (
        echo  [ERROR] Download failed.
        echo  Please manually install Node.js 20+ from https://nodejs.org/
        pause
        exit /b 1
    )

    echo  Installing Node.js 20.18.0...
    msiexec /i "%NODE_INSTALLER%" /qn /norestart

    if errorlevel 1 (
        echo  [WARN] Silent install returned error. Trying interactive install...
        msiexec /i "%NODE_INSTALLER%"
    )

    :: PATH 갱신
    set "PATH=C:\Program Files\nodejs;%PATH%"

    node --version >nul 2>&1
    if errorlevel 1 (
        echo  [ERROR] Node.js installation failed.
        echo  Please restart this terminal and try again,
        echo  or manually install from https://nodejs.org/
        pause
        exit /b 1
    )

    echo  [OK] Node.js installed successfully
    node --version

    del "%NODE_INSTALLER%" >nul 2>&1
) else (
    echo  [OK] Node.js found
    node --version
)

:: ============================================
:: 3. Python 패키지 설치
:: ============================================
echo.
echo  [1/4] Installing Python dependencies...
cd /d "%~dp0apps\backend"
%PYTHON_CMD% -m pip install --upgrade pip >nul 2>&1
%PYTHON_CMD% -m pip install fastapi uvicorn python-multipart pydantic pydantic-settings python-jose aiofiles sqlalchemy aiosqlite httpx PyMuPDF python-docx openpyxl python-pptx lxml olefile 2>&1 | findstr /i "successfully already"
if errorlevel 1 echo  (Some packages may have been skipped)

:: ============================================
:: 4. Node.js 패키지 설치
:: ============================================
echo.
echo  [2/4] Installing Node.js dependencies...
cd /d "%~dp0"
call npm install 2>&1 | findstr /i "added up"

:: ============================================
:: 5. WASM 파일 복사
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
        echo  [OK] WASM files copied from frontend node_modules
    ) else (
        echo  [SKIP] web-ifc WASM not found - IFC 3D viewer will use fallback
    )
)

:: ============================================
:: 6. 업로드 디렉토리
:: ============================================
echo.
echo  [4/4] Creating upload directory...
if not exist "apps\backend\uploads" mkdir "apps\backend\uploads"
echo  [OK] Upload directory ready

:: ============================================
:: 완료
:: ============================================
echo.
echo  ============================================
echo   Installation complete!
echo.
echo   To start: run start.bat
echo   Demo login: demo@bim-vortex.com / demo1234
echo  ============================================
echo.
pause
