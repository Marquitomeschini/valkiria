@echo off
rem Valkiria: crea una tarea programada que busca actualizaciones cada hora.
rem Doble clic una sola vez. Para sacarla: desactivar-actualizaciones.cmd
setlocal
set "VBS=%~dp0actualizar.vbs"

where git >nul 2>nul
if errorlevel 1 (
  echo No encuentro Git. Instalalo desde https://git-scm.com/download/win y volve a ejecutar este archivo.
  pause
  exit /b 1
)

schtasks /Create /F /TN "Valkiria\Actualizar" /SC HOURLY /TR "wscript.exe \"%VBS%\"" >nul
if errorlevel 1 (
  echo No se pudo crear la tarea programada.
  pause
  exit /b 1
)

echo Buscando actualizaciones ahora...
wscript.exe "%VBS%"
echo.
echo Listo: Valkiria se va a actualizar sola cada hora.
echo Cuando llegue una version nueva, se recarga sola en el navegador.
pause
