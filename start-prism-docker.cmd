@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-prism.ps1" -Docker %*
exit /b %ERRORLEVEL%
