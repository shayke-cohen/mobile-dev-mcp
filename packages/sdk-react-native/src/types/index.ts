/**
 * Type definitions for MCP React Native SDK
 */

export interface MCPConfig {
  /** WebSocket server URL (default: ws://localhost:8765) */
  serverUrl?: string;
  /** Auto-connect on initialization (default: true) */
  autoConnect?: boolean;
  /** Reconnection interval in ms (default: 3000) */
  reconnectInterval?: number;
  /** Command timeout in ms (default: 10000) */
  timeout?: number;
  /** Enable verbose logging (default: false) */
  debug?: boolean;
}

export type StateGetter = () => unknown;

export interface MCPCommand {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: string;
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    body?: unknown;
    duration: number;
  };
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  args?: unknown[];
  source?: string;
}

export interface ErrorEntry {
  message: string;
  stack?: string;
  timestamp: string;
  context: {
    route?: string;
    state?: unknown;
    lastActions?: string[];
  };
}

export interface ComponentNode {
  name: string;
  type: string;
  props?: Record<string, unknown>;
  state?: unknown;
  children?: ComponentNode[];
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
