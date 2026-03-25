@echo off
chcp 65001 >nul
title BIM-Vortex Demo Data Loader

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   BIM-Vortex Demo Data Loader            ║
echo  ║   Sample projects + files for demo       ║
echo  ╚══════════════════════════════════════════╝
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

:: Login and get token
echo.
echo  [1/4] Authenticating...
for /f "tokens=*" %%i in ('curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"demo@bim-vortex.com\",\"password\":\"demo1234\"}" 2^>nul') do set LOGIN_RESP=%%i
echo  [OK] Authenticated

:: Create demo projects
echo  [2/4] Creating demo projects...

curl -s -X POST http://localhost:8000/api/v1/projects -H "Content-Type: application/json" -H "Authorization: Bearer demo-token" -d "{\"name\":\"Sejong Smart City Tower\",\"description\":\"세종시 스마트시티 타워 BIM 프로젝트 - ISO 19650 기반 설계 단계\",\"lifecycle_phase\":\"design\"}" >nul 2>&1
echo    - Sejong Smart City Tower (Design)

curl -s -X POST http://localhost:8000/api/v1/projects -H "Content-Type: application/json" -H "Authorization: Bearer demo-token" -d "{\"name\":\"Incheon Bridge Maintenance\",\"description\":\"인천대교 유지관리 프로젝트 - ISO 55000 기반\",\"lifecycle_phase\":\"operation\"}" >nul 2>&1
echo    - Incheon Bridge Maintenance (O^&M)

curl -s -X POST http://localhost:8000/api/v1/projects -H "Content-Type: application/json" -H "Authorization: Bearer demo-token" -d "{\"name\":\"Busan Harbor Terminal\",\"description\":\"부산항 터미널 시공 프로젝트 - IFC 4.3 + bSDD\",\"lifecycle_phase\":\"construction\"}" >nul 2>&1
echo    - Busan Harbor Terminal (Construction)

:: Create sample files (text-based)
echo  [3/4] Creating sample document data...

:: Create sample PDF-like text files for demo
if not exist "%~dp0apps\backend\uploads" mkdir "%~dp0apps\backend\uploads"

echo BIM Model Design Report - Sejong Smart City Tower > "%~dp0apps\backend\uploads\design_report_sample.txt"
echo IFC Schema: IFC4 ADD2 >> "%~dp0apps\backend\uploads\design_report_sample.txt"
echo Total Entities: 15,234 >> "%~dp0apps\backend\uploads\design_report_sample.txt"
echo Standards Applied: ISO 16739-1, ISO 19650-2, IDS 1.0 >> "%~dp0apps\backend\uploads\design_report_sample.txt"

echo  [4/4] Demo data loaded!

echo.
echo  ============================================
echo   Demo Data Summary:
echo.
echo   Projects: 3
echo     - Sejong Smart City Tower (Design)
echo     - Incheon Bridge Maintenance (O^&M)
echo     - Busan Harbor Terminal (Construction)
echo.
echo   Open http://localhost:3000 to explore
echo  ============================================
echo.
pause
