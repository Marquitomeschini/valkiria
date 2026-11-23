#!/bin/bash
# Valkiria: deja de buscar actualizaciones automaticas (la extension sigue funcionando).
PLIST="$HOME/Library/LaunchAgents/com.valkiria.actualizar.plist"
launchctl bootout "gui/$(id -u)/com.valkiria.actualizar" >/dev/null 2>&1 || launchctl unload "$PLIST" >/dev/null 2>&1
rm -f "$PLIST"
echo "Listo: Valkiria ya no se actualiza sola."
echo "Para volver a activarlo, ejecuta de nuevo el instalador."
echo
echo "Podes cerrar esta ventana."
