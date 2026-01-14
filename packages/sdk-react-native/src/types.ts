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

// ==================== Tracing Types ====================

export interface TraceInfo {
  /** Arguments passed to the function */
  args?: Record<string, unknown>;
  /** Source file name */
  file?: string;
  /** Start time (Date.now()) for duration calculation */
  startTime?: number;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

export interface TraceEntry {
  /** Unique trace ID */
  id: string;
  /** Function name (e.g., "UserService.fetchUser") */
  name: string;
  /** Trace info including args, file, timing */
  info: TraceInfo;
  /** Timestamp when trace started */
  timestamp: number;
  /** Duration in ms (set when traceReturn is called) */
  duration?: number;
  /** Return value (set when traceReturn is called) */
  returnValue?: unknown;
  /** Error if function threw */
  error?: string;
  /** Whether trace is complete */
  completed: boolean;
}

export interface TraceFilter {
  /** Filter by function name pattern */
  name?: string;
  /** Filter by file pattern */
  file?: string;
  /** Only show traces longer than this duration (ms) */
  minDuration?: number;
  /** Only show traces from last N milliseconds */
  since?: number;
  /** Maximum number of traces to return */
  limit?: number;
  /** Only show incomplete/in-progress traces */
  inProgress?: boolean;
}
