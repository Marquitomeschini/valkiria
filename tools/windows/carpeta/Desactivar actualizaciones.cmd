@echo off
rem Valkiria: deja de buscar actualizaciones automaticas (la extension sigue funcionando).
schtasks /Delete /F /TN "Valkiria\Actualizar" >nul 2>nul
echo Listo: Valkiria ya no se actualiza sola.
echo Para volver a activarlo, ejecuta de nuevo instalar-valkiria.cmd
echo.
pause
