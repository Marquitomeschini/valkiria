#!/bin/bash
# Valkiria - actualizador para Mac. Lo ejecuta cada 15 minutos el agente
# "com.valkiria.actualizar" (creado por instalar-valkiria.command). Si GitHub tiene
# otra version, la baja y reemplaza los archivos; la extension detecta el cambio y se
# recarga sola en el navegador.
# Todo esta dentro de main(): bash lee el archivo completo antes de ejecutarlo, asi que
# reemplazar este mismo archivo durante la actualizacion no lo rompe.

main() {
  REPO="Marquitomeschini/valkiria"
  UPD="$(cd "$(dirname "$0")" && pwd)"
  BASE="$(dirname "$UPD")"
  EXT="$BASE/extension"
  LOG="$UPD/ultimo-resultado.txt"
  MANIFEST_URL="${VALKIRIA_MANIFEST_URL:-https://raw.githubusercontent.com/$REPO/main/extension/manifest.json}"
  ZIP_URL="${VALKIRIA_ZIP_URL:-https://github.com/$REPO/archive/refs/heads/main.zip}"

  result() {
    echo "$(date '+%Y-%m-%d %H:%M')  $1" > "$LOG"
    echo "$1"
  }
  version_of() {
    grep -m1 '"version"' | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
  }
  replace_dir() { # copia $1 sobre $2 (reemplaza todo el contenido)
    rm -rf "$2.nuevo" && cp -R "$1" "$2.nuevo" && rm -rf "$2" && mv "$2.nuevo" "$2"
  }

  LOCAL="$(version_of < "$EXT/manifest.json" 2>/dev/null)"
  REMOTE="$(curl -fsSL --max-time 30 "$MANIFEST_URL" 2>/dev/null | version_of)"
  if [ -z "$REMOTE" ]; then
    result "Error: no se pudo leer la version de GitHub (sin internet?)."
    return 1
  fi
  if [ "$REMOTE" = "$LOCAL" ]; then
    result "Al dia: version $LOCAL."
    return 0
  fi

  TMP="$(mktemp -d "${TMPDIR:-/tmp}/valkiria.XXXXXX")" || { result "Error: no se pudo crear una carpeta temporal."; return 1; }
  trap 'rm -rf "$TMP"' EXIT
  if ! curl -fsSL --max-time 120 "$ZIP_URL" -o "$TMP/v.zip"; then
    result "Error: no se pudo descargar la version $REMOTE."
    return 1
  fi
  if ! unzip -q "$TMP/v.zip" -d "$TMP/x"; then
    result "Error: la descarga esta danada."
    return 1
  fi
  SRC="$(find "$TMP/x" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [ ! -f "$SRC/extension/manifest.json" ]; then
    result "Error: la descarga no trae la extension."
    return 1
  fi
  replace_dir "$SRC/extension" "$EXT" || { result "Error: no se pudieron copiar los archivos."; return 1; }
  replace_dir "$SRC/tools/mac/actualizador" "$UPD" || { result "Error: no se pudo copiar el actualizador."; return 1; }
  cp "$SRC/tools/mac/carpeta/"*.command "$BASE/" 2>/dev/null
  chmod +x "$UPD/"*.sh "$BASE/"*.command 2>/dev/null
  result "Actualizada de ${LOCAL:-?} a $REMOTE. Se recarga sola en el navegador en menos de un minuto."
  return 0
}

main "$@"
exit $?
