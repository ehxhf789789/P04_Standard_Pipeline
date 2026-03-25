@echo off
title BIM-Vortex Demo Data Loader

echo.
echo  ============================================
echo   BIM-Vortex Demo Data Loader
echo   Sample projects for demo
echo  ============================================
echo.

:: Check if server is running
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Backend server is not running!
    echo  Please run start.bat first.
    pause
    exit /b 1
)
echo  [OK] Backend server is running

echo.
echo  Creating demo projects...

curl -s -X POST http://localhost:8000/api/v1/projects -H "Content-Type: application/json" -d "{\"name\":\"Sejong Smart City Tower\",\"description\":\"BIM Project - ISO 19650 Design Phase\",\"lifecycle_phase\":\"design\"}" >nul 2>&1
echo    - Sejong Smart City Tower (Design)

curl -s -X POST http://localhost:8000/api/v1/projects -H "Content-Type: application/json" -d "{\"name\":\"Incheon Bridge Maintenance\",\"description\":\"Maintenance Project - ISO 55000\",\"lifecycle_phase\":\"operation\"}" >nul 2>&1
echo    - Incheon Bridge Maintenance (O+M)

curl -s -X POST http://localhost:8000/api/v1/projects -H "Content-Type: application/json" -d "{\"name\":\"Busan Harbor Terminal\",\"description\":\"Construction Project - IFC 4.3 + bSDD\",\"lifecycle_phase\":\"construction\"}" >nul 2>&1
echo    - Busan Harbor Terminal (Construction)

if not exist "%~dp0apps\backend\uploads" mkdir "%~dp0apps\backend\uploads"

echo.
echo  ============================================
echo   Demo Data Loaded!
echo.
echo   Projects: 3
echo   Open http://localhost:3000 to explore
echo  ============================================
echo.
pause
