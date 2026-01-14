#!/usr/bin/env node

/**
 * Mobile Dev MCP Server
 * 
 * Bridges Cursor IDE with mobile applications via WebSocket connection.
 * Exposes MCP tools for AI-assisted mobile development.
 * 
 * Usage:
 *   node dist/index.js              # Normal mode (stdio + WebSocket)
 *   node dist/index.js --standalone # Standalone mode (WebSocket only, for testing)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServer } from './connection/websocket-server.js';
import { DeviceManager } from './connection/device-manager.js';
import { registerAllTools } from './tools/index.js';

const PORT = parseInt(process.env.MCP_PORT || '8765', 10);
const LOG_LEVEL = process.env.MCP_LOG_LEVEL || 'info';
const STANDALONE = process.argv.includes('--standalone');

function log(level: string, message: string, ...args: unknown[]) {
  const levels = ['debug', 'info', 'warn', 'error'];
  if (levels.indexOf(level) >= levels.indexOf(LOG_LEVEL)) {
    const timestamp = new Date().toISOString().slice(11, 19);
    console.error(`[${timestamp}] [MCP Server] [${level.toUpperCase()}] ${message}`, ...args);
  }
}

async function main() {
  log('info', 'Starting Mobile Dev MCP Server...');
  log('info', `Mode: ${STANDALONE ? 'STANDALONE (WebSocket only)' : 'NORMAL (stdio + WebSocket)'}`);

  // Start WebSocket server for mobile app connections
  const wsServer = new WebSocketServer({ port: PORT });
  const deviceManager = new DeviceManager(wsServer);

  if (STANDALONE) {
    // Standalone mode: WebSocket only, no stdio (for testing)
    log('info', `Mobile Dev MCP Server running in STANDALONE mode`);
    log('info', `WebSocket listening on ws://localhost:${PORT}`);
    log('info', `Press Ctrl+C to stop`);
    log('info', '');
    log('info', 'Waiting for connections...');
    
    // Keep process alive
    process.on('SIGINT', () => {
      log('info', 'Shutting down...');
      wsServer.close();
      process.exit(0);
    });
    
    // Prevent exit
    setInterval(() => {}, 1000);
  } else {
    // Normal mode: stdio + WebSocket (for Cursor)
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
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
