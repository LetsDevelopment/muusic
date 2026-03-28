#!/bin/zsh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
setopt null_glob

for candidate in \
  "$(command -v node 2>/dev/null)" \
  "/opt/homebrew/bin/node" \
  "/usr/local/bin/node" \
  "/opt/local/bin/node" \
  "/Library/Frameworks/Node.framework/Versions/Current/bin/node" \
  "$HOME/.asdf/shims/node" \
  "$HOME/.volta/bin/node" \
  "$HOME/.nvm/versions/node/"*/bin/node
do
  if [[ -n "$candidate" && -x "$candidate" ]]; then
    exec "$candidate" "$SCRIPT_DIR/muusic-bridge-macos.mjs"
  fi
done

osascript -e 'display dialog "Node.js não encontrado nos caminhos padrão. Abra o Terminal e rode: which node" buttons {"OK"} default button "OK"'
