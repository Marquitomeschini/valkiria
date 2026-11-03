' Valkiria: ejecuta actualizar.ps1 sin abrir ninguna ventana (lo usa la tarea programada).
Option Explicit
Dim fso, dir
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\actualizar.ps1""", 0, True
