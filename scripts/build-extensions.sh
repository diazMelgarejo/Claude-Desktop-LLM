#!/bin/bash
# Build script for .mcpb extensions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
EXTENSIONS_DIR="$ROOT_DIR/extensions"
OUTPUT_DIR="$ROOT_DIR/dist"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Building MCP extensions..."

# Build Ollama Agent
echo ""
echo "=== Building Ollama Agent ==="
cd "$EXTENSIONS_DIR/ollama-agent"
npm install --production
echo "✓ Dependencies installed"

# Build LM Studio Agent
echo ""
echo "=== Building LM Studio Agent ==="
cd "$EXTENSIONS_DIR/lmstudio-agent"
npm install --production
echo "✓ Dependencies installed"

echo ""
echo "=== Packaging extensions ==="

# Check if mcpb CLI is available
if command -v mcpb &> /dev/null; then
    echo "Using mcpb CLI to create .mcpb files..."

    cd "$EXTENSIONS_DIR/ollama-agent"
    mcpb pack . "$OUTPUT_DIR/ollama-agent.mcpb"
    echo "✓ Created ollama-agent.mcpb"

    cd "$EXTENSIONS_DIR/lmstudio-agent"
    mcpb pack . "$OUTPUT_DIR/lmstudio-agent.mcpb"
    echo "✓ Created lmstudio-agent.mcpb"
else
    echo "mcpb CLI not found. Creating ZIP archives manually..."
    echo "Install mcpb with: npm install -g @anthropic-ai/mcpb"
    echo ""

    # Create ZIP archives (rename to .mcpb)
    cd "$EXTENSIONS_DIR/ollama-agent"
    zip -r "$OUTPUT_DIR/ollama-agent.mcpb" . -x "*.DS_Store"
    echo "✓ Created ollama-agent.mcpb"

    cd "$EXTENSIONS_DIR/lmstudio-agent"
    zip -r "$OUTPUT_DIR/lmstudio-agent.mcpb" . -x "*.DS_Store"
    echo "✓ Created lmstudio-agent.mcpb"
fi

echo ""
echo "=== Build complete ==="
echo "Extensions created in: $OUTPUT_DIR"
echo "  - ollama-agent.mcpb"
echo "  - lmstudio-agent.mcpb"
echo ""
echo "To install in Claude Desktop:"
echo "  1. Open Claude Desktop"
echo "  2. Go to Settings → Extensions"
echo "  3. Click 'Advanced settings' → 'Install Extension...'"
echo "  4. Select the .mcpb file"
