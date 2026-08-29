#!/bin/bash
# Build script for .mcpb extensions -- builds the canonical TypeScript
# implementation ONCE, then stages a copy of the compiled output plus each
# extension's manifest into a clean temp directory per extension, installs
# production dependencies there (npm ci --omit=dev, lockfile-strict), and
# packs. The extension directories under extensions/*/ contain only
# manifests and packaging metadata -- no server source is duplicated.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
EXTENSIONS_DIR="$ROOT_DIR/extensions"
OUTPUT_DIR="$ROOT_DIR/dist-release"

echo "=== Building canonical TypeScript implementation ==="
cd "$ROOT_DIR"
npm ci
npm run build
echo "✓ Canonical build complete: dist/"

mkdir -p "$OUTPUT_DIR"

package_extension() {
  local name="$1"
  local ext_dir="$EXTENSIONS_DIR/$name"
  local staging
  staging="$(mktemp -d)"

  echo ""
  echo "=== Staging $name ==="
  mkdir -p "$staging/server"
  cp -R "$ROOT_DIR/dist/." "$staging/server/"
  cp "$ext_dir/manifest.json" "$staging/manifest.json"
  cp "$ROOT_DIR/package.json" "$staging/package.json"
  echo "✓ Copied canonical dist/ + manifest"

  echo "Installing production dependencies (lockfile-strict)..."
  # --ignore-scripts: dist/ is already the built output copied in above: the
  # staged package.json's own "prepare" -> "npm run build" -> tsc would fail
  # here anyway, since --omit=dev deliberately excludes the typescript
  # devDependency from this production-only install.
  (cd "$staging" && cp "$ROOT_DIR/package-lock.json" . && npm ci --omit=dev --ignore-scripts)
  echo "✓ Dependencies installed"

  if command -v mcpb &> /dev/null; then
    (cd "$staging" && mcpb pack . "$OUTPUT_DIR/$name.mcpb")
  else
    echo "mcpb CLI not found -- creating ZIP archive manually. Install with: npm install -g @anthropic-ai/mcpb"
    (cd "$staging" && zip -rq "$OUTPUT_DIR/$name.mcpb" . -x "*.DS_Store")
  fi
  echo "✓ Created $name.mcpb"

  rm -rf "$staging"
}

package_extension "ollama-agent"
package_extension "lmstudio-agent"

echo ""
echo "=== Build complete ==="
echo "Extensions created in: $OUTPUT_DIR"
echo "  - ollama-agent.mcpb"
echo "  - lmstudio-agent.mcpb"
echo ""
echo "To install in Claude Desktop:"
echo "  1. Open Claude Desktop"
echo "  2. Go to Settings -> Extensions"
echo "  3. Click 'Advanced settings' -> 'Install Extension...'"
echo "  4. Select the .mcpb file"
