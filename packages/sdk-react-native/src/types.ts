/**
 * MCP SDK Types
 */

export interface MCPConfig {
  /** WebSocket server URL (default: ws://localhost:8765 for iOS, ws://10.0.2.2:8765 for Android) */
  serverUrl?: string;
  /** Enable debug logging (default: true in __DEV__) */
  debug?: boolean;
  /** Reconnection interval in ms (default: 3000) */
  reconnectInterval?: number;
}

export interface MCPCommand {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export type StateGetter = () => unknown;
export type ActionHandler = (params: Record<string, unknown>) => Promise<unknown> | unknown;

export interface ActivityEntry {
  timestamp: string;
  message: string;
}

export interface MCPState {
  isConnected: boolean;
  lastActivity: string;
  reconnectCount: number;
  activityLog: ActivityEntry[];
}

export interface RegisteredComponent {
  testId: string;
  type: string;
  props?: Record<string, unknown>;
  bounds?: { x: number; y: number; width: number; height: number };
  onPress?: () => void;
  onChangeText?: (text: string) => void;
  getText?: () => string;
  children?: string[];
}

export interface ComponentConfig {
  type: string;
  props?: Record<string, unknown>;
  bounds?: { x: number; y: number; width: number; height: number };
  onPress?: () => void;
  onChangeText?: (text: string) => void;
  getText?: () => string;
  children?: string[];
}

export interface NetworkMock {
  id: string;
  urlPattern: RegExp;
  response: {
    statusCode: number;
    body: unknown;
    headers?: Record<string, string>;
    delay?: number;
  };
}

export interface NavigationState {
  currentRoute: string;
  params?: Record<string, unknown>;
  history: Array<{ route: string; timestamp: number }>;
}

export type StateCallback = (state: MCPState) => void;
