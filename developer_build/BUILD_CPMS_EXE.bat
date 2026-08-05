@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."
title CPMS v5.1 Build

echo ============================================================
echo CPMS v5.1 EXE BUILD
echo ============================================================
echo Project: %CD%
echo.

if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"
if exist "build_log.txt" del /q "build_log.txt"

where py >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python launcher not found.
    echo Install Python 3.11 or newer and enable the py launcher.
    pause
    exit /b 1
)

echo [1/4] Installing required packages...
py -3 -m pip install -r requirements.txt >> build_log.txt 2>&1
if errorlevel 1 goto build_error

echo [2/4] Installing PyInstaller...
py -3 -m pip install pyinstaller >> build_log.txt 2>&1
if errorlevel 1 goto build_error

echo [3/4] Building CPMS.exe...
py -3 -m PyInstaller --clean --noconfirm "developer_build\CPMS.spec" >> build_log.txt 2>&1
if errorlevel 1 goto build_error

if not exist "dist\CPMS.exe" (
    echo [ERROR] PyInstaller finished but dist\CPMS.exe was not created.
    goto build_error
)

echo [4/4] Creating runtime folder...
mkdir "dist\CPMS" 2>nul
copy /y "dist\CPMS.exe" "dist\CPMS\CPMS.exe" >nul

for %%D in (Config Resources Manufacturers Update Archive Backup History Log Purchase_Analysis PDF_Review Rejected) do (
    if exist "%%D" xcopy "%%D" "dist\CPMS\%%D\" /E /I /Y >nul
)

if not exist "dist\CPMS\CPMS.exe" (
    echo [ERROR] Runtime EXE copy failed.
    goto build_error
)

echo.
echo ============================================================
echo BUILD COMPLETE
echo EXE: %CD%\dist\CPMS\CPMS.exe
echo ============================================================
start "" explorer.exe "%CD%\dist\CPMS"
pause
exit /b 0

:build_error
echo.
echo ============================================================
echo BUILD FAILED
echo Check: %CD%\build_log.txt
echo ============================================================
type build_log.txt
pause
exit /b 1
