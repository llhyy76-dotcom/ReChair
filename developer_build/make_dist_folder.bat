@echo off
setlocal
cd /d "%~dp0\.."
if not exist "dist\CPMS.exe" exit /b 1
if exist "dist\CPMS" rmdir /s /q "dist\CPMS"
mkdir "dist\CPMS"
copy /y "dist\CPMS.exe" "dist\CPMS\CPMS.exe" >nul
for %%D in (Config Resources Manufacturers Update Archive Backup History Log Purchase_Analysis PDF_Review Rejected) do (
  if exist "%%D" xcopy "%%D" "dist\CPMS\%%D\" /E /I /Y >nul
)
exit /b 0
