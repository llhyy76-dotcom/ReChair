@echo off
chcp 65001 > nul
setlocal
cd /d "%~dp0\.."

if not exist "dist\CPMS.exe" (
    echo dist\CPMS.exe가 없습니다. 먼저 CPMS_EXE_빌드.bat를 실행하세요.
    pause
    exit /b 1
)

set TARGET=dist\CPMS
if exist "%TARGET%" rmdir /s /q "%TARGET%"
mkdir "%TARGET%"
copy /y "dist\CPMS.exe" "%TARGET%\CPMS.exe" >nul

for %%D in (Config Resources Manufacturers Update Archive Backup History Log Purchase_Analysis PDF_Review Rejected) do (
    if exist "%%D" xcopy "%%D" "%TARGET%\%%D\" /E /I /Y >nul
)

echo 배포 폴더 생성 완료: %TARGET%
pause
endlocal
