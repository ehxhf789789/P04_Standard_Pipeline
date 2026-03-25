@echo off
chcp 65001 >nul
title openBIM-AI Pipeline - Stopping

echo ============================================
echo   Stopping openBIM-AI Pipeline...
echo ============================================
echo.

:: Kill processes on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do (
    echo Stopping Frontend (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

:: Kill processes on port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING" 2^>nul') do (
    echo Stopping Backend (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo All servers stopped.
echo.
timeout /t 2 /nobreak >nul
