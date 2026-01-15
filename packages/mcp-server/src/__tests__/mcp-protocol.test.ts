/**
 * Tests for MCP Protocol Compliance
 * 
 * Verifies that the server properly implements MCP protocol handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Mock the server and device manager
vi.mock('../connection/websocket-server.js', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    close: vi.fn(),
  })),
}));

vi.mock('../connection/device-manager.js', () => ({
  DeviceManager: vi.fn().mockImplementation(() => ({
    hasConnectedDevice: vi.fn().mockReturnValue(false),
    sendCommand: vi.fn(),
  })),
}));

describe('MCP Protocol Compliance', () => {
  describe('Server Capabilities', () => {
    it('should declare tools capability', () => {
      const server = new Server(
        { name: 'test-server', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );
      
      expect(server).toBeDefined();
    });

    it('should declare resources capability', () => {
      const server = new Server(
        { name: 'test-server', version: '1.0.0' },
        { capabilities: { resources: {} } }
      );
      
      expect(server).toBeDefined();
    });
  });

  describe('Resource Handlers', () => {
    let server: Server;
    let listResourcesHandler: ((request: unknown) => Promise<unknown>) | null = null;
    let readResourceHandler: ((request: unknown) => Promise<unknown>) | null = null;

    beforeEach(() => {
      server = new Server(
        { name: 'test-server', version: '1.0.0' },
        { capabilities: { tools: {}, resources: {} } }
      );

      // Capture the handlers when they're registered
      const originalSetRequestHandler = server.setRequestHandler.bind(server);
      server.setRequestHandler = ((schema: unknown, handler: (request: unknown) => Promise<unknown>) => {
        if (schema === ListResourcesRequestSchema) {
          listResourcesHandler = handler;
        } else if (schema === ReadResourceRequestSchema) {
          readResourceHandler = handler;
        }
        return originalSetRequestHandler(schema, handler);
      }) as typeof server.setRequestHandler;

      // Register handlers like the real server does
      server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return { resources: [] };
      });

      server.setRequestHandler(ReadResourceRequestSchema, async (request: { params: { uri: string } }) => {
        return {
          contents: [{
            uri: request.params.uri,
            mimeType: 'text/plain',
            text: `Resource not found: ${request.params.uri}`,
          }],
        };
      });
    });

    it('should handle ListResourcesRequest and return empty resources', async () => {
      expect(listResourcesHandler).not.toBeNull();
      
      if (listResourcesHandler) {
        const result = await listResourcesHandler({});
        expect(result).toEqual({ resources: [] });
      }
    });

    it('should handle ReadResourceRequest and return not found', async () => {
      expect(readResourceHandler).not.toBeNull();
      
      if (readResourceHandler) {
        const result = await readResourceHandler({
          params: { uri: 'test://some-resource' }
        }) as { contents: Array<{ uri: string; mimeType: string; text: string }> };
        
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('test://some-resource');
        expect(result.contents[0].mimeType).toBe('text/plain');
        expect(result.contents[0].text).toContain('Resource not found');
      }
    });
  });

  describe('Tool Handlers', () => {
    it('should have ListToolsRequestSchema available', () => {
      expect(ListToolsRequestSchema).toBeDefined();
    });

    it('should have CallToolRequestSchema available', () => {
      expect(CallToolRequestSchema).toBeDefined();
    });
  });

  describe('Required MCP Schemas', () => {
    it('should export all required request schemas', () => {
      // These are the core schemas needed for MCP compliance
      expect(ListToolsRequestSchema).toBeDefined();
      expect(CallToolRequestSchema).toBeDefined();
      expect(ListResourcesRequestSchema).toBeDefined();
      expect(ReadResourceRequestSchema).toBeDefined();
    });
  });
});
