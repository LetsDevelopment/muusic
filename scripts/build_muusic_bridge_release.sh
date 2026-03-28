#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

"$ROOT_DIR/scripts/build_muusic_bridge_app.sh"
"$ROOT_DIR/scripts/build_muusic_bridge_dmg.sh"

echo "Muusic Bridge release artifacts generated in $ROOT_DIR/public/downloads"
