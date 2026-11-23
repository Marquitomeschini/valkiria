#!/bin/bash
# Valkiria - instalador para Mac. Doble clic, o en la Terminal:
#   curl -fsSL https://raw.githubusercontent.com/Marquitomeschini/valkiria/main/instalar-valkiria-mac.command | bash
# Baja la extension a ~/Valkiria y activa las actualizaciones automaticas (cada 15 minutos).

main() {
  REPO="Marquitomeschini/valkiria"
  BASE="${VALKIRIA_HOME:-$HOME/Valkiria}"
  ZIP_URL="${VALKIRIA_ZIP_URL:-https://github.com/$REPO/archive/refs/heads/main.zip}"
  EXT="$BASE/extension"
  UPD="$BASE/actualizador"
  AGENT="com.valkiria.actualizar"
  PLIST="$HOME/Library/LaunchAgents/$AGENT.plist"

  fail() {
    echo
    echo "  ERROR: $1"
    echo "  Revisa tu conexion a internet y volve a ejecutar el instalador."
    echo
    return 1
  }
  replace_dir() { # copia $1 sobre $2 (reemplaza todo el contenido)
    rm -rf "$2.nuevo" && cp -R "$1" "$2.nuevo" && rm -rf "$2" && mv "$2.nuevo" "$2"
  }
  xml() { # escapa texto para el plist
    printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
  }

  echo
  echo "  VALKIRIA - instalador para Mac"
  echo "  ------------------------------"

  echo "  1/3  Descargando la ultima version..."
  TMP="$(mktemp -d "${TMPDIR:-/tmp}/valkiria.XXXXXX")" || { fail "No se pudo crear una carpeta temporal."; return 1; }
  trap 'rm -rf "$TMP"' EXIT
  curl -fsSL --max-time 120 "$ZIP_URL" -o "$TMP/v.zip" || { fail "No se pudo descargar Valkiria."; return 1; }
  unzip -q "$TMP/v.zip" -d "$TMP/x" || { fail "La descarga esta danada."; return 1; }
  SRC="$(find "$TMP/x" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  [ -f "$SRC/extension/manifest.json" ] || { fail "La descarga no trae la extension."; return 1; }
  mkdir -p "$BASE" || { fail "No se pudo crear la carpeta $BASE."; return 1; }
  replace_dir "$SRC/extension" "$EXT" || { fail "No se pudieron copiar los archivos."; return 1; }
  replace_dir "$SRC/tools/mac/actualizador" "$UPD" || { fail "No se pudo copiar el actualizador."; return 1; }
  cp "$SRC/tools/mac/carpeta/"*.command "$BASE/" 2>/dev/null
  chmod +x "$UPD/"*.sh "$BASE/"*.command 2>/dev/null
  VERSION="$(grep -m1 '"version"' "$EXT/manifest.json" | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
  echo "       Valkiria $VERSION quedo en $EXT"

  echo "  2/3  Activando las actualizaciones automaticas (cada 15 minutos)..."
  mkdir -p "$(dirname "$PLIST")"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$AGENT</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$(xml "$UPD/actualizar.sh")</string></array>
  <key>StartInterval</key><integer>900</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/dev/null</string>
  <key>StandardErrorPath</key><string>/dev/null</string>
</dict>
</plist>
PLIST
  if command -v launchctl >/dev/null 2>&1; then
    launchctl bootout "gui/$(id -u)/$AGENT" >/dev/null 2>&1
    if launchctl bootstrap "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || launchctl load -w "$PLIST" >/dev/null 2>&1; then
      echo "       Listo."
    else
      echo "       No se pudo activar. Valkiria funciona igual, pero no se va a actualizar sola."
    fi
  fi

  echo "  3/3  Abriendo el navegador..."
  printf '%s' "$EXT" | pbcopy 2>/dev/null
  BROWSER=""
  for app in "Brave Browser" "Google Chrome" "Microsoft Edge"; do
    if [ -d "/Applications/$app.app" ] || [ -d "$HOME/Applications/$app.app" ]; then
      BROWSER="$app"
      break
    fi
  done
  case "$BROWSER" in
    "Google Chrome") NAME="Chrome"; URL="chrome://extensions"; LOAD="Cargar descomprimida" ;;
    "Microsoft Edge") NAME="Edge"; URL="edge://extensions"; LOAD="Cargar desempaquetada" ;;
    *) NAME="Brave"; URL="brave://extensions"; LOAD="Cargar descomprimida" ;; # Brave, or none found
  esac
  if [ -n "$BROWSER" ] && command -v open >/dev/null 2>&1; then
    open -a "$BROWSER" "$URL" >/dev/null 2>&1 || open -a "$BROWSER" >/dev/null 2>&1
  fi

  echo
  echo "  ================================================================"
  echo "   FALTA UN SOLO PASO, EN $(echo "$NAME" | tr '[:lower:]' '[:upper:]') (se hace una vez):"
  echo
  echo "   1. Entra a $URL y activa \"Modo de desarrollador\"."
  echo "   2. Si tenes otra Valkiria (o FeedOrden) cargada, toca \"Quitar\"."
  echo "   3. Toca \"$LOAD\". En la ventana, apreta Cmd+Shift+G,"
  echo "      pega con Cmd+V, apreta Enter y toca \"Seleccionar\"."
  echo "   4. Fija el icono: pieza de rompecabezas -> pin al lado de Valkiria."
  echo
  echo "   La ruta ya esta copiada: $EXT"
  echo "  ================================================================"
  echo
  return 0
}

main "$@"
exit $?
