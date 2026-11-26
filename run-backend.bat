@echo off
title PQ Nihongo Backend
echo ========================================================
echo   DANG KHOI DONG BACKEND PQ NIHONGO (Port 8080)
echo   Ket noi Database PostgreSQL 16 (nihongoai)
echo ========================================================
cd /d "%~dp0backend"

if "%JAVA_HOME%"=="" (
    if exist "C:\Program Files\Java\jdk-23" set "JAVA_HOME=C:\Program Files\Java\jdk-23"
)

:: Doc cac bien tu file .env neu co
if exist "%~dp0.env" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
        if not "%%A"=="" (
            set "%%A=%%B"
        )
    )
)

if "%SPRING_PROFILES_ACTIVE%"=="" set "SPRING_PROFILES_ACTIVE=dev"
if "%SPRING_DATASOURCE_PASSWORD%"=="" set "SPRING_DATASOURCE_PASSWORD=123456"

echo Su dung Java: %JAVA_HOME%
echo Profile: %SPRING_PROFILES_ACTIVE%
echo Database URL: %SPRING_DATASOURCE_URL%

call mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=%SPRING_PROFILES_ACTIVE%
pause
