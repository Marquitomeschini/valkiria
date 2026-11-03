@echo off
rem Valkiria - instalador para Windows. Doble clic y listo.
rem Baja la extension a %USERPROFILE%\Valkiria y activa las actualizaciones automaticas.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=[IO.File]::ReadAllText('%~f0'); iex $s.Substring($s.IndexOf('#'+'##PS'))"
echo.
pause
exit /b

###PS  (desde aca es PowerShell; el cmd de arriba lo ejecuta)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = 'Marquitomeschini/valkiria'
$Base = Join-Path $env:USERPROFILE 'Valkiria'
$Ext  = Join-Path $Base 'extension'
$Upd  = Join-Path $Base 'actualizador'

function Copy-Folder($from, $to, $exclude) {
  $rc = @($from, $to, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
  if ($exclude) { $rc += @('/XF', $exclude) }
  & robocopy @rc | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "No se pudieron copiar los archivos a $to (robocopy $LASTEXITCODE)." }
}

Write-Host ''
Write-Host '  VALKIRIA - instalador'
Write-Host '  ---------------------'
try {
  Write-Host '  1/3  Descargando la ultima version...'
  $zip = Join-Path $env:TEMP ('valkiria-' + [guid]::NewGuid().ToString() + '.zip')
  $tmp = Join-Path $env:TEMP ('valkiria-' + [guid]::NewGuid().ToString())
  Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/archive/refs/heads/main.zip" -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $src = (Get-ChildItem -Path $tmp -Directory | Select-Object -First 1).FullName
  if (-not (Test-Path (Join-Path $src 'extension\manifest.json'))) { throw 'La descarga no trae la extension.' }

  New-Item -ItemType Directory -Force -Path $Ext, $Upd | Out-Null
  Copy-Folder (Join-Path $src 'extension') $Ext $null
  Copy-Folder (Join-Path $src 'tools\windows\actualizador') $Upd 'ultimo-resultado.txt'
  Copy-Item -Force (Join-Path $src 'tools\windows\carpeta\*') $Base
  Remove-Item -Recurse -Force $zip, $tmp -ErrorAction SilentlyContinue
  $version = (Get-Content -Raw -Encoding UTF8 (Join-Path $Ext 'manifest.json') | ConvertFrom-Json).version
  Write-Host "       Valkiria $version quedo en $Ext"

  Write-Host '  2/3  Activando las actualizaciones automaticas (cada 15 minutos)...'
  $vbs = [Security.SecurityElement]::Escape((Join-Path $Upd 'actualizar.vbs'))
  $user = [Security.SecurityElement]::Escape([Security.Principal.WindowsIdentity]::GetCurrent().Name)
  $start = (Get-Date).AddMinutes(2).ToString('s')
  $xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Valkiria: busca e instala actualizaciones de la extension.</Description></RegistrationInfo>
  <Triggers>
    <TimeTrigger>
      <Repetition><Interval>PT15M</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition>
      <StartBoundary>$start</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author"><UserId>$user</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <ExecutionTimeLimit>PT10M</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author"><Exec><Command>wscript.exe</Command><Arguments>"$vbs"</Arguments></Exec></Actions>
</Task>
"@
  $xmlFile = Join-Path $env:TEMP 'valkiria-tarea.xml'
  [IO.File]::WriteAllText($xmlFile, $xml, [Text.Encoding]::Unicode)
  & schtasks.exe /Create /F /TN 'Valkiria\Actualizar' /XML $xmlFile | Out-Null
  $ok = $LASTEXITCODE -eq 0
  Remove-Item -Force $xmlFile -ErrorAction SilentlyContinue
  if ($ok) { Write-Host '       Listo.' } else { Write-Host '       No se pudo crear la tarea. Valkiria funciona igual, pero no se va a actualizar sola.' }

  Write-Host '  3/3  Abriendo brave://extensions...'
  Set-Clipboard -Value $Ext
  $brave = @(
    (Join-Path $env:ProgramFiles 'BraveSoftware\Brave-Browser\Application\brave.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'BraveSoftware\Brave-Browser\Application\brave.exe'),
    (Join-Path $env:LOCALAPPDATA 'BraveSoftware\Brave-Browser\Application\brave.exe')
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if ($brave) { try { Start-Process -FilePath $brave -ArgumentList 'brave://extensions' } catch {} }

  Write-Host ''
  Write-Host '  ================================================================'
  Write-Host '   FALTA UN SOLO PASO, EN BRAVE (se hace una vez):'
  Write-Host ''
  Write-Host '   1. En brave://extensions, activa "Modo de desarrollador".'
  Write-Host '   2. Si tenes otra Valkiria o FeedOrden cargada, toca "Quitar".'
  Write-Host '   3. Toca "Cargar descomprimida". En la ventana, hace clic en la'
  Write-Host '      barra de arriba (donde dice la carpeta), pega con Ctrl+V,'
  Write-Host '      apreta Enter y toca "Seleccionar carpeta".'
  Write-Host ''
  Write-Host "   La ruta ya esta copiada: $Ext"
  Write-Host '  ================================================================'
} catch {
  Write-Host ''
  Write-Host "  ERROR: $($_.Exception.Message)"
  Write-Host '  Revisa tu conexion a internet y volve a ejecutar el instalador.'
}
