@echo off
rem Valkiria: trae la ultima version ahora mismo (sin esperar a la hora siguiente).
git -C "%~dp0..\.." pull --ff-only
echo.
echo Si dice "Already up to date", ya tenes la ultima version.
pause
