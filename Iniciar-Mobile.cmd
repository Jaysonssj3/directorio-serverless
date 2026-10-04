@echo off
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0Iniciar-Mobile.ps1" %*
pause
