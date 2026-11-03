@echo off
rem Valkiria: borra la tarea programada de actualizaciones.
schtasks /Delete /F /TN "Valkiria\Actualizar" >nul 2>nul
echo Listo: Valkiria ya no se actualiza sola.
echo Para volver a activarlo, ejecuta activar-actualizaciones.cmd
pause
