@echo off
setlocal
set "DIR=%~dp0"
if "%JAVA_HOME%"=="" (
    if exist "C:\Program Files\Java\jdk-23" set "JAVA_HOME=C:\Program Files\Java\jdk-23"
)
set "MAVEN_HOME=%DIR%.mvn\maven"
call "%MAVEN_HOME%\bin\mvn.cmd" %*
exit /b %ERRORLEVEL%

