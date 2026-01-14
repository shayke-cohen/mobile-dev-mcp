/**
 * Trace Tools Tests
 * 
 * Tests for tracing and debug mode tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { DeviceManager } from '../connection/device-manager';
import { WebSocketServer } from '../connection/websocket-server';
import { handleLogsTool, logsTools } from '../tools/logs';
import { handleDebugTool, debugTools } from '../tools/debug';

describe('Trace Tools', () => {
  let wsServer: WebSocketServer;
  let deviceManager: DeviceManager;
  let serverPort: number;
  let mockClient: WebSocket;

  beforeEach(async () => {
    serverPort = 8900 + Math.floor(Math.random() * 100);
    wsServer = new WebSocketServer({ port: serverPort });
    deviceManager = new DeviceManager(wsServer);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Connect mock device
    mockClient = new WebSocket(`ws://localhost:${serverPort}`);
    
    await new Promise<void>((resolve) => {
      mockClient.on('open', () => {
        mockClient.send(JSON.stringify({
          type: 'handshake',
          platform: 'react-native',
          appName: 'TestApp',
          appVersion: '1.0.0',
          capabilities: ['state', 'network', 'logs', 'tracing'],
        }));
      });

      mockClient.on('message', () => resolve());
    });

    // Mock client responds to trace commands
    mockClient.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method) {
        let result: unknown;
        
        switch (msg.method) {
          case 'get_traces':
            result = { 
              traces: [
                { id: 'trace_1', name: 'CartService.addItem', duration: 50, completed: true },
                { id: 'trace_2', name: 'UserService.login', duration: 150, completed: true },
                { id: 'trace_3', name: 'API.fetch', duration: 200, error: 'Network error', completed: true },
              ]
            };
            break;
          case 'get_active_traces':
            result = { traces: [] };
            break;
          case 'clear_traces':
            result = { success: true };
            break;
          case 'inject_trace':
            result = { id: `inject_${Date.now()}`, success: true };
            break;
          case 'remove_trace':
            result = { success: true };
            break;
          case 'clear_injected_traces':
            result = { cleared: 2, success: true };
            break;
          case 'list_injected_traces':
            result = { traces: [] };
            break;
          default:
            result = { error: 'Unknown method' };
        }
        
        mockClient.send(JSON.stringify({ id: msg.id, result }));
      }
    });
  });

  afterEach(async () => {
    mockClient?.close();
    await wsServer.close();
  });

  describe('logsTools definitions', () => {
    it('should include trace tools', () => {
      const traceToolNames = ['get_traces', 'get_active_traces', 'clear_traces', 'get_slow_traces', 'get_failed_traces'];
      
      for (const name of traceToolNames) {
        const tool = logsTools.find(t => t.name === name);
        expect(tool).toBeDefined();
        expect(tool?.description).toBeDefined();
        expect(tool?.inputSchema).toBeDefined();
      }
    });
  });

  describe('debugTools definitions', () => {
    it('should include debug mode tools', () => {
      const debugToolNames = ['inject_trace', 'remove_trace', 'clear_injected_traces', 'list_injected_traces', 'start_debug_session', 'end_debug_session'];
      
      for (const name of debugToolNames) {
        const tool = debugTools.find(t => t.name === name);
        expect(tool).toBeDefined();
        expect(tool?.description).toBeDefined();
      }
    });

    it('inject_trace should have pattern parameter', () => {
      const tool = debugTools.find(t => t.name === 'inject_trace');
      expect(tool?.inputSchema.properties).toHaveProperty('pattern');
      expect(tool?.inputSchema.required).toContain('pattern');
    });

    it('start_debug_session should have required parameters', () => {
      const tool = debugTools.find(t => t.name === 'start_debug_session');
      expect(tool?.inputSchema.properties).toHaveProperty('description');
      expect(tool?.inputSchema.properties).toHaveProperty('tracePatterns');
      expect(tool?.inputSchema.required).toContain('description');
      expect(tool?.inputSchema.required).toContain('tracePatterns');
    });
  });

  describe('handleLogsTool', () => {
    it('should handle get_traces', async () => {
      const result = await handleLogsTool('get_traces', { limit: 10 }, deviceManager);
      expect(result).toHaveProperty('traces');
      expect(Array.isArray((result as { traces: unknown[] }).traces)).toBe(true);
    });

    it('should handle get_slow_traces by converting to get_traces with minDuration', async () => {
      const result = await handleLogsTool('get_slow_traces', { minDuration: 100 }, deviceManager);
      expect(result).toHaveProperty('traces');
    });

    it('should handle get_failed_traces by filtering traces with errors', async () => {
      const result = await handleLogsTool('get_failed_traces', { limit: 10 }, deviceManager);
      expect(result).toHaveProperty('traces');
      // The handler filters traces with errors
      const traces = (result as { traces: Array<{ error?: string }> }).traces;
      expect(traces.every(t => t.error !== undefined)).toBe(true);
    });

    it('should handle clear_traces', async () => {
      const result = await handleLogsTool('clear_traces', {}, deviceManager);
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('handleDebugTool', () => {
    it('should handle inject_trace', async () => {
      const result = await handleDebugTool('inject_trace', { pattern: 'CartService.*' }, deviceManager) as { id: string; success: boolean };
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('id');
    });

    it('should handle remove_trace', async () => {
      const result = await handleDebugTool('remove_trace', { id: 'inject_123' }, deviceManager);
      expect(result).toHaveProperty('success', true);
    });

    it('should handle clear_injected_traces', async () => {
      const result = await handleDebugTool('clear_injected_traces', {}, deviceManager);
      expect(result).toHaveProperty('success', true);
    });

    it('should handle list_injected_traces', async () => {
      const result = await handleDebugTool('list_injected_traces', {}, deviceManager);
      expect(result).toHaveProperty('traces');
    });

    it('should handle start_debug_session', async () => {
      const result = await handleDebugTool('start_debug_session', {
        description: 'Test debug session',
        hypotheses: ['hypothesis 1'],
        tracePatterns: ['CartService.*', 'UserService.*'],
      }, deviceManager) as { session: string; injectedTraces: string[] };
      
      expect(result.session).toBe('started');
      expect(Array.isArray(result.injectedTraces)).toBe(true);
    });

    it('should handle end_debug_session', async () => {
      const result = await handleDebugTool('end_debug_session', {
        fixed: true,
        summary: 'Fixed the bug',
      }, deviceManager) as { session: string; cleanup: string };
      
      expect(result.session).toBe('ended');
      expect(result.cleanup).toContain('removed');
    });
  });
});
