@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title CPMS v5.1

if exist "dist\CPMS\CPMS.exe" goto run

echo CPMS.exe is not present. Starting the first build...
call "developer_build\BUILD_CPMS_EXE.bat"
if errorlevel 1 (
    echo.
    echo CPMS build failed. See build_log.txt.
    pause
    exit /b 1
)

if not exist "dist\CPMS\CPMS.exe" (
    echo.
    echo Build ended but dist\CPMS\CPMS.exe is still missing.
    echo See build_log.txt.
    pause
    exit /b 1
)

:run
start "" "dist\CPMS\CPMS.exe"
exit /b 0
