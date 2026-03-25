#!/bin/zsh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if command -v node >/dev/null 2>&1; then
  node "$SCRIPT_DIR/muusic-bridge-macos.mjs"
else
  osascript -e 'display dialog "Node.js não encontrado. Instale o Node.js neste Mac para usar o Muusic Bridge." buttons {"OK"} default button "OK"'
fi
