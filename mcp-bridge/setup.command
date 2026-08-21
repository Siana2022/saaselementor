#!/bin/bash
# Doble-clic para instalar/añadir un sitio. Requiere Node instalado.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node no está instalado. Instálalo desde https://nodejs.org (botón verde) y vuelve a abrir este archivo."
  read -n 1 -s -r -p "Pulsa una tecla para cerrar..."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Preparando (primera vez)..."; npm install >/dev/null 2>&1
fi
node setup.mjs
echo ""
read -n 1 -s -r -p "Pulsa una tecla para cerrar esta ventana..."
