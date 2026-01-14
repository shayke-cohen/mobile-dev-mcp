#!/bin/bash

# Start MCP Server in Standalone Mode
# 
# This script starts the MCP server in standalone mode (WebSocket only).
# Use this when you want to run the server in a separate terminal for
# debugging, testing, or development purposes.
#
# Usage:
#   ./scripts/start-server.sh             # Default port 8765
#   ./scripts/start-server.sh --port=9000 # Custom port
#   MCP_PORT=9000 ./scripts/start-server.sh
#
# Then run tests in another terminal:
#   pnpm test:e2e --use-existing-server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_PATH="$ROOT_DIR/packages/mcp-server/dist/index.js"

# Parse arguments
for arg in "$@"; do
  case $arg in
    --port=*)
      export MCP_PORT="${arg#*=}"
      shift
      ;;
    --debug)
      export MCP_LOG_LEVEL="debug"
      shift
      ;;
    *)
      ;;
  esac
done

# Default port
MCP_PORT=${MCP_PORT:-8765}

# Check if server is built
if [ ! -f "$SERVER_PATH" ]; then
  echo "⚠️  Server not built. Building now..."
  cd "$ROOT_DIR"
  pnpm build
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              MCP Server - Standalone Mode                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  WebSocket: ws://localhost:$MCP_PORT"
echo "  Mode:      Standalone (WebSocket only, no stdio)"
echo ""
echo "  This server accepts connections from:"
echo "    • Mobile SDKs (iOS, Android, React Native)"
echo "    • E2E tests (pnpm test:e2e --use-existing-server)"
echo "    • Test client (pnpm test:client)"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

# Run server in standalone mode
node "$SERVER_PATH" --standalone
