@echo off
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0Iniciar-Backend.ps1" %*
pause
