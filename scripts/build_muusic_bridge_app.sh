#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOWNLOADS_DIR="$ROOT_DIR/public/downloads"
APP_NAME="Muusic Bridge.app"
APP_DIR="$DOWNLOADS_DIR/$APP_NAME"
ZIP_PATH="$DOWNLOADS_DIR/$APP_NAME.zip"
NODE_BIN="${NODE_BIN:-$(command -v node)}"

if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Node binary not found. Set NODE_BIN or install Node locally." >&2
  exit 1
fi

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources/bin"

cp "$ROOT_DIR/public/downloads/muusic-bridge-macos.mjs" "$APP_DIR/Contents/Resources/muusic-bridge.mjs"
cp "$NODE_BIN" "$APP_DIR/Contents/Resources/bin/node"

cat > "$APP_DIR/Contents/Info.plist" <<'EOF'
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
  <key>CFBundleName</key>
  <string>Muusic Bridge</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.2.0</string>
  <key>CFBundleVersion</key>
  <string>2</string>
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

if [[ ! -x "$NODE_BIN" ]]; then
  osascript -e 'display dialog "Runtime do Muusic Bridge não encontrado dentro do app." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

exec "$NODE_BIN" "$SCRIPT_PATH"
EOF

chmod +x "$APP_DIR/Contents/MacOS/Muusic Bridge"
chmod +x "$APP_DIR/Contents/Resources/bin/node"

rm -f "$ZIP_PATH"
ditto -c -k --sequesterRsrc --keepParent "$APP_DIR" "$ZIP_PATH"
echo "Built: $ZIP_PATH"
