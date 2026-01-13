/**
 * WebSocket client for connecting to MCP server
 */

import type { MCPCommand, MCPResponse } from '../types';

interface WebSocketClientConfig {
  url: string;
  reconnectInterval: number;
  timeout: number;
  debug: boolean;
  onCommand: (command: MCPCommand) => Promise<unknown>;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketClientConfig;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;

  constructor(config: WebSocketClientConfig) {
    this.config = config;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.log('debug', `Connecting to ${this.config.url}...`);
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        this.connected = true;
        this.log('info', 'Connected to MCP server');
        this.sendHandshake();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = (event) => {
        this.connected = false;
        this.log('warn', `Disconnected: ${event.code} ${event.reason}`);
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        this.log('error', 'WebSocket error:', error);
      };

    } catch (error) {
      this.log('error', 'Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private sendHandshake(): void {
    const { Platform } = require('react-native');
    
    this.send({
      type: 'handshake',
      platform: 'react-native',
      osVersion: Platform.Version,
      appName: 'Unknown', // Would come from native module
      appVersion: '0.0.0',
      capabilities: [
        'state',
        'network',
        'logs',
        'ui',
        'screenshot',
      ],
    });
  }

  private async handleMessage(data: string): Promise<void> {
    try {
      const message = JSON.parse(data);

      // Handle handshake acknowledgment
      if (message.type === 'handshake_ack') {
        this.log('debug', `Handshake acknowledged, device ID: ${message.deviceId}`);
        return;
      }

      // Handle command from MCP server
      if (message.method && message.id) {
        try {
          const result = await this.config.onCommand(message as MCPCommand);
          this.sendResponse(message.id, result);
        } catch (error) {
          this.sendError(message.id, error instanceof Error ? error.message : 'Unknown error');
        }
      }

    } catch (error) {
      this.log('error', 'Failed to parse message:', error);
    }
  }

  private sendResponse(id: string, result: unknown): void {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id,
      result,
    };
    this.send(response);
  }

  private sendError(id: string, message: string): void {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message,
      },
    };
    this.send(response);
  }

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.config.reconnectInterval);
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: unknown[]): void {
    if (!this.config.debug && level === 'debug') return;
    console[level](`[MCP WS] ${message}`, ...args);
  }
}
