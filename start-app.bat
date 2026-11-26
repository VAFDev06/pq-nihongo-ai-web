@echo off
chcp 65001 >nul
title PQ Nihongo AI - Launcher

echo ========================================================
echo   PQ NIHONGO AI - KHOI DONG HE THONG (BACKEND + FRONTEND)
echo ========================================================

echo [0/2] Dang giai phong cong 8080 va 3000 (neu co tien trinh cu)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080,3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo [1/2] Dang khoi dong Backend Spring Boot (Port 8080)...
start "PQ Nihongo Backend" cmd /k "cd /d %~dp0backend && .\mvnw.cmd spring-boot:run"

echo [2/2] Dang khoi dong Frontend Vite React (Port 3000)...
start "PQ Nihongo Frontend" cmd /k "cd /d %~dp0frontend && npm run dev -- --port 3000"

echo.
echo He thong dang khoi dong! Truy cap trinh duyet tai: http://localhost:3000
pause
