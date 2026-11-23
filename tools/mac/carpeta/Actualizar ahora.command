#!/bin/bash
# Valkiria: busca una version nueva ahora mismo, sin esperar los 15 minutos.
cd "$(dirname "$0")" || exit 1
/bin/bash actualizador/actualizar.sh
echo
echo "Podes cerrar esta ventana."
