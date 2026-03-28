#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOWNLOADS_DIR="$ROOT_DIR/public/downloads"
APP_NAME="Muusic Bridge.app"
APP_DIR="$DOWNLOADS_DIR/$APP_NAME"
ZIP_PATH="$DOWNLOADS_DIR/$APP_NAME.zip"
APP_VERSION="${APP_VERSION:-0.3.0}"
NODE_BIN="${NODE_BIN:-$(command -v node)}"
ICON_SOURCE="$ROOT_DIR/src/assets/logo-muusic.png"
ICONSET_DIR="$DOWNLOADS_DIR/.muusic-bridge-iconset"
ICON_PATH="$APP_DIR/Contents/Resources/AppIcon.icns"

if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Node binary not found. Set NODE_BIN or install Node locally." >&2
  exit 1
fi

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources/bin"

cp "$ROOT_DIR/public/downloads/muusic-bridge-macos.mjs" "$APP_DIR/Contents/Resources/muusic-bridge.mjs"
cp "$NODE_BIN" "$APP_DIR/Contents/Resources/bin/node"

if [[ -f "$ICON_SOURCE" ]] && command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
  rm -rf "$ICONSET_DIR"
  mkdir -p "$ICONSET_DIR"
  sips -z 16 16 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
  sips -z 32 32 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
  sips -z 32 32 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
  sips -z 64 64 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
  sips -z 128 128 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
  sips -z 256 256 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
  sips -z 256 256 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
  sips -z 512 512 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
  sips -z 512 512 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
  cp "$ICON_SOURCE" "$ICONSET_DIR/icon_512x512@2x.png"
  iconutil -c icns "$ICONSET_DIR" -o "$ICON_PATH"
  rm -rf "$ICONSET_DIR"
fi

cat > "$APP_DIR/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>pt-BR</string>
  <key>CFBundleDisplayName</key>
  <string>Muusic Bridge</string>
  <key>CFBundleExecutable</key>
  <string>Muusic Bridge</string>
  <key>CFBundleIdentifier</key>
  <string>live.muusic.bridge</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleName</key>
  <string>Muusic Bridge</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${APP_VERSION}</string>
  <key>CFBundleVersion</key>
  <string>3</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF

cat > "$APP_DIR/Contents/MacOS/Muusic Bridge" <<'EOF'
#!/bin/zsh
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$APP_ROOT/Resources/bin/node"
SCRIPT_PATH="$APP_ROOT/Resources/muusic-bridge.mjs"
setopt null_glob

if [[ -x "$NODE_BIN" ]]; then
  exec "$NODE_BIN" "$SCRIPT_PATH"
fi

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
    exec "$candidate" "$SCRIPT_PATH"
  fi
done

osascript -e 'display dialog "Runtime do Muusic Bridge não encontrado dentro do app nem nos caminhos padrão do macOS." buttons {"OK"} default button "OK" with icon caution'
exit 1
EOF

chmod +x "$APP_DIR/Contents/MacOS/Muusic Bridge"
chmod +x "$APP_DIR/Contents/Resources/bin/node"

rm -f "$ZIP_PATH"
ditto -c -k --sequesterRsrc --keepParent "$APP_DIR" "$ZIP_PATH"
echo "Built: $ZIP_PATH"
