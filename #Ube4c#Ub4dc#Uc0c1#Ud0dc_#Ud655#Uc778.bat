@echo off
setlocal
cd /d "%~dp0"
echo CPMS BUILD CHECK
echo ================================
where py
py -3 --version
echo.
echo Project files:
if exist "main.py" (echo main.py: OK) else (echo main.py: MISSING)
if exist "developer_build\CPMS.spec" (echo CPMS.spec: OK) else (echo CPMS.spec: MISSING)
if exist "requirements.txt" (echo requirements.txt: OK) else (echo requirements.txt: MISSING)
echo.
echo Output:
if exist "dist\CPMS\CPMS.exe" (echo dist\CPMS\CPMS.exe: OK) else (echo dist\CPMS\CPMS.exe: MISSING)
if exist "build_log.txt" (
  echo.
  echo Last build log:
  type build_log.txt
)
pause
