# Valkiria - actualizador. Lo ejecuta cada 15 minutos la tarea "Valkiria\Actualizar"
# (creada por instalar-valkiria.cmd). Si GitHub tiene otra version, la baja y reemplaza los
# archivos; la extension detecta el cambio y se recarga sola en el navegador.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = 'Marquitomeschini/valkiria'
$Upd  = $PSScriptRoot
$Base = Split-Path $Upd -Parent
$Ext  = Join-Path $Base 'extension'
$Log  = Join-Path $Upd 'ultimo-resultado.txt'

function Write-Result($text) {
  $line = (Get-Date -Format 'yyyy-MM-dd HH:mm') + '  ' + $text
  Set-Content -Path $Log -Value $line -Encoding UTF8
  Write-Host $line
}

function Copy-Folder($from, $to, $exclude) {
  $rc = @($from, $to, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
  if ($exclude) { $rc += @('/XF', $exclude) }
  & robocopy @rc | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "No se pudieron copiar los archivos a $to (robocopy $LASTEXITCODE)." }
}

try {
  $local = (Get-Content -Raw -Encoding UTF8 (Join-Path $Ext 'manifest.json') | ConvertFrom-Json).version
  # GitHub serves the file as text/plain, so parse the JSON explicitly.
  $remote = ((Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/$Repo/main/extension/manifest.json").Content | ConvertFrom-Json).version
  if (-not $remote) { throw 'No se pudo leer la version de GitHub.' }
  if ($remote -eq $local) {
    Write-Result "Al dia: version $local."
    exit 0
  }

  $zip = Join-Path $env:TEMP ('valkiria-' + [guid]::NewGuid().ToString() + '.zip')
  $tmp = Join-Path $env:TEMP ('valkiria-' + [guid]::NewGuid().ToString())
  Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/archive/refs/heads/main.zip" -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $src = (Get-ChildItem -Path $tmp -Directory | Select-Object -First 1).FullName
  if (-not (Test-Path (Join-Path $src 'extension\manifest.json'))) { throw 'La descarga no trae la extension.' }

  Copy-Folder (Join-Path $src 'extension') $Ext $null
  Copy-Folder (Join-Path $src 'tools\windows\actualizador') $Upd 'ultimo-resultado.txt'
  Copy-Item -Force (Join-Path $src 'tools\windows\carpeta\*') $Base
  Remove-Item -Recurse -Force $zip, $tmp -ErrorAction SilentlyContinue
  Write-Result "Actualizada de $local a $remote. Se recarga sola en el navegador en menos de un minuto."
} catch {
  Write-Result ("Error: " + $_.Exception.Message)
  exit 1
}
