@echo off
chcp 65001 > nul
setlocal
cd /d "%~dp0\.."
title CPMS EXE Build

echo ==========================================================
echo CPMS.exe 빌드
echo ==========================================================
echo.

where py >nul 2>nul
if errorlevel 1 (
    echo Python이 설치되어 있지 않습니다.
    pause
    exit /b 1
)

py -3 -m pip install -r requirements.txt
if errorlevel 1 (
    echo 필수 모듈 설치 실패
    pause
    exit /b 1
)

py -3 -m PyInstaller --clean --noconfirm "개발자용_BUILD\CPMS.spec"
if errorlevel 1 (
    echo CPMS.exe 빌드 실패
    pause
    exit /b 1
)

echo.
echo 빌드 완료: dist\CPMS.exe
echo CPMS.exe는 반드시 Config, Manufacturers, Update 폴더와 같은 위치에서 실행하세요.
pause
endlocal
