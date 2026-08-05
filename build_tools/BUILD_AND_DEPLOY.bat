@echo off
setlocal
cd /d "%~dp0\.."
title CPMS Build and Deploy
where py >nul 2>nul
if errorlevel 1 goto NO_PYTHON
py -3 -c "import PyInstaller" >nul 2>nul
if errorlevel 1 goto INSTALL_MODULES
goto BUILD

:INSTALL_MODULES
echo Installing PyInstaller and required modules...
py -3 -m pip install -r requirements.txt pyinstaller
if errorlevel 1 goto INSTALL_FAILED

:BUILD
py -3 -m PyInstaller --clean --noconfirm "build_tools\CPMS.spec"
if errorlevel 1 goto BUILD_FAILED
if not exist "dist\CPMS.exe" goto EXE_MISSING
if exist "dist\CPMS" rmdir /s /q "dist\CPMS"
mkdir "dist\CPMS"
copy /y "dist\CPMS.exe" "dist\CPMS\CPMS.exe" >nul
for %%D in (Config Resources Manufacturers Update Archive Backup History Log Purchase_Analysis PDF_Review Rejected) do (
  if exist "%%D" xcopy "%%D" "dist\CPMS\%%D\" /E /I /Y >nul
)
echo.
echo CPMS deployment created: dist\CPMS\CPMS.exe
exit /b 0

:NO_PYTHON
echo Python Launcher was not found.
echo Install Python 3.11 or later.
exit /b 1
:INSTALL_FAILED
echo Module installation failed.
exit /b 1
:BUILD_FAILED
echo PyInstaller build failed.
exit /b 1
:EXE_MISSING
echo dist\CPMS.exe was not created.
exit /b 1
