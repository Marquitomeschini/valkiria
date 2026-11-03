' Valkiria: trae la ultima version desde GitHub sin abrir ventanas.
' Lo ejecuta la tarea programada "Valkiria\Actualizar" (ver activar-actualizaciones.cmd).
Option Explicit
Dim fso, sh, repo
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
' Este archivo esta en <repo>\tools\windows\ : el repositorio es dos carpetas mas arriba.
repo = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))
' 0 = ventana oculta, True = esperar a que termine
' credential.interactive=never: si GitHub pidiera iniciar sesion, no queda esperando oculto
sh.Run "git -c credential.interactive=never -C """ & repo & """ pull --ff-only --quiet", 0, True
