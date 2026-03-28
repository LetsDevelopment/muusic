#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOWNLOADS_DIR="$ROOT_DIR/public/downloads"
APP_NAME="Muusic Bridge.app"
APP_DIR="$DOWNLOADS_DIR/$APP_NAME"
DMG_PATH="$DOWNLOADS_DIR/Muusic Bridge.dmg"
STAGING_DIR="${TMPDIR:-/tmp}/muusic-bridge-dmg"

cleanup() {
  rm -rf "$STAGING_DIR"
}

trap cleanup EXIT

if [[ ! -d "$APP_DIR" ]]; then
  "$ROOT_DIR/scripts/build_muusic_bridge_app.sh"
fi

mkdir -p "$STAGING_DIR"
cp -R "$APP_DIR" "$STAGING_DIR/$APP_NAME"
ln -s /Applications "$STAGING_DIR/Applications"

rm -f "$DMG_PATH"
hdiutil create \
  -volname "Muusic Bridge" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

echo "Built: $DMG_PATH"
