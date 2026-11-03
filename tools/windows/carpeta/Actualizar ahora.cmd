@echo off
rem Valkiria: busca una version nueva ahora mismo, sin esperar los 15 minutos.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0actualizador\actualizar.ps1"
echo.
pause
