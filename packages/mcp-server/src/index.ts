#!/usr/bin/env node

/**
 * Mobile Dev MCP Server
 * 
 * Bridges Cursor IDE with mobile applications via WebSocket connection.
 * Exposes MCP tools for AI-assisted mobile development.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServer } from './connection/websocket-server.js';
import { DeviceManager } from './connection/device-manager.js';
import { registerAllTools } from './tools/index.js';

const PORT = parseInt(process.env.MCP_PORT || '8765', 10);
const LOG_LEVEL = process.env.MCP_LOG_LEVEL || 'info';

function log(level: string, message: string, ...args: unknown[]) {
  const levels = ['debug', 'info', 'warn', 'error'];
  if (levels.indexOf(level) >= levels.indexOf(LOG_LEVEL)) {
    console.error(`[MCP Server] [${level.toUpperCase()}] ${message}`, ...args);
  }
}

async function main() {
  log('info', 'Starting Mobile Dev MCP Server...');

  // Create MCP server instance
  const server = new Server(
    {
      name: 'mobile-dev-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Start WebSocket server for mobile app connections
  const wsServer = new WebSocketServer({ port: PORT });
  const deviceManager = new DeviceManager(wsServer);

  // Register all MCP tools
  registerAllTools(server, deviceManager);

  // Handle server errors
  server.onerror = (error) => {
    log('error', 'MCP Server error:', error);
  };

  // Connect to Cursor via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('info', `Mobile Dev MCP Server running`);
  log('info', `- WebSocket listening on ws://localhost:${PORT}`);
  log('info', `- Connected to Cursor via stdio`);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    log('info', 'Shutting down...');
    wsServer.close();
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
