/**
 * MCP Bridge - React Native SDK (Inline Version)
 * 
 * This is a standalone version of the MCP SDK for the demo app.
 * In production, you would install @mobile-dev-mcp/react-native
 */

declare const __DEV__: boolean;

interface MCPConfig {
  serverUrl?: string;
  debug?: boolean;
  reconnectInterval?: number;
}

interface MCPCommand {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

type StateGetter = () => unknown;
type ActionHandler = (params: Record<string, unknown>) => Promise<unknown> | unknown;

// Activity log entry
interface ActivityEntry {
  timestamp: string;
  message: string;
}

// State change callbacks
type StateCallback = (state: MCPState) => void;

interface MCPState {
  isConnected: boolean;
  lastActivity: string;
  reconnectCount: number;
  activityLog: ActivityEntry[];
}

class MCPBridgeClass {
  private ws: WebSocket | null = null;
  private stateGetters: Map<string, StateGetter> = new Map();
  private actionHandlers: Map<string, ActionHandler> = new Map();
  private logs: Array<{ level: string; message: string; timestamp: number }> = [];
  private networkRequests: Array<{
    id: string;
    url: string;
    method: string;
    status?: number;
    timestamp: number;
  }> = [];
  private featureFlags: Map<string, boolean> = new Map();
  private config: Required<MCPConfig> = {
    serverUrl: this.getDefaultServerUrl(),
    debug: true,
    reconnectInterval: 3000,
  };
  
  private getDefaultServerUrl(): string {
    const { Platform } = require('react-native');
    const DEFAULT_PORT = '8765';
    // Android emulator uses 10.0.2.2 to reach host machine
    // iOS simulator and real devices use localhost
    const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    return `ws://${host}:${DEFAULT_PORT}`;
  }
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private originalFetch: typeof fetch | null = null;
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    info: typeof console.info;
  } | null = null;
  
  // State tracking
  private _isConnected = false;
  private _lastActivity = '';
  private _reconnectCount = 0;
  private _activityLog: ActivityEntry[] = [];
  private stateCallbacks: Set<StateCallback> = new Set();

  /**
   * Initialize the MCP SDK
   */
  initialize(config: MCPConfig = {}): void {
    if (typeof __DEV__ !== 'undefined' && !__DEV__) {
      console.log('[MCP SDK] Only works in development mode');
      return;
    }

    if (this.initialized) {
      console.log('[MCP SDK] Already initialized');
      return;
    }

    this.config = { ...this.config, ...config };
    this.connect();
    this.initialized = true;
    console.log(`[MCP SDK] Initialized, connecting to ${this.config.serverUrl}`);
  }

  /**
   * Connect to WebSocket server
   */
  private connect(): void {
    this.logActivity('Connecting to ' + this.config.serverUrl + '...');
    
    try {
      this.ws = new WebSocket(this.config.serverUrl);

      this.ws.onopen = () => {
        this._isConnected = true;
        this._reconnectCount = 0;
        this.logActivity('Connected!');
        this.notifyStateChange();
        
        // Send handshake (expected by device manager)
        const { Platform } = require('react-native');
        this.sendMessage({
          type: 'handshake',
          platform: 'react-native',
          appName: 'MCP Demo Store',
          appVersion: '1.0.0',
          deviceId: `rn_${Platform.OS}_${Date.now()}`,
          capabilities: ['state', 'logs', 'network', 'featureFlags'],
        });
        this.logActivity('Sent handshake');
      };

      this.ws.onclose = () => {
        this._isConnected = false;
        this.logActivity('Disconnected');
        this.notifyStateChange();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        this._isConnected = false;
        this.logActivity('Connection error');
        this.notifyStateChange();
        if (this.config.debug) {
          console.log('[MCP SDK] Connection error:', error);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const command = JSON.parse(event.data) as MCPCommand;
          this.handleCommand(command);
        } catch (e) {
          console.error('[MCP SDK] Failed to parse message:', e);
        }
      };
    } catch (error) {
      this._isConnected = false;
      this.logActivity('Failed to connect');
      this.notifyStateChange();
      console.error('[MCP SDK] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.initialized) return;
    if (this.reconnectTimer) return;
    
    this._reconnectCount++;
    this.logActivity(`Reconnecting in ${this.config.reconnectInterval / 1000}s (attempt ${this._reconnectCount})...`);
    this.notifyStateChange();
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.config.reconnectInterval);
  }
  
  private logActivity(message: string): void {
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const entry: ActivityEntry = { timestamp: `[${timestamp}]`, message };
    
    this._activityLog.push(entry);
    if (this._activityLog.length > 50) {
      this._activityLog.shift();
    }
    this._lastActivity = `[${timestamp}] ${message}`;
    
    if (this.config.debug) {
      console.log(`[MCP SDK] ${message}`);
    }
  }
  
  private notifyStateChange(): void {
    const state: MCPState = {
      isConnected: this._isConnected,
      lastActivity: this._lastActivity,
      reconnectCount: this._reconnectCount,
      activityLog: [...this._activityLog],
    };
    this.stateCallbacks.forEach(cb => cb(state));
  }

  private sendMessage(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private sendResponse(id: string, result: unknown): void {
    this.sendMessage({ type: 'response', id, result });
  }

  private sendError(id: string, error: string): void {
    this.sendMessage({ type: 'response', id, error });
  }

  /**
   * Handle incoming command from MCP server
   */
  private async handleCommand(command: MCPCommand): Promise<void> {
    const { id, method, params = {} } = command;

    if (!method) return; // Ignore non-command messages
    
    this.logActivity(`← Command: ${method}`);

    try {
      let result: unknown;

      switch (method) {
        // State commands
        case 'get_app_state':
          result = this.getAppState(params);
          break;
        case 'list_feature_flags':
          result = this.getFeatureFlags();
          break;
        case 'toggle_feature_flag':
          result = this.toggleFeatureFlag(params);
          break;

        // Network commands
        case 'list_network_requests':
          result = this.getNetworkRequests(params);
          break;

        // Log commands
        case 'get_logs':
          result = this.getLogs(params);
          break;
        case 'get_recent_errors':
          result = this.getRecentErrors(params);
          break;

        // Device commands
        case 'get_device_info':
          result = this.getDeviceInfo();
          break;
        case 'get_app_info':
          result = this.getAppInfo();
          break;

        // Action commands
        case 'list_actions':
          result = this.getRegisteredActions();
          break;
        case 'navigate_to':
          result = await this.executeAction('navigate', params);
          break;
        case 'execute_action':
          result = await this.executeAction(params.action as string, params);
          break;
        case 'add_to_cart':
          result = await this.executeAction('addToCart', params);
          break;
        case 'remove_from_cart':
          result = await this.executeAction('removeFromCart', params);
          break;
        case 'clear_cart':
          result = await this.executeAction('clearCart', params);
          break;
        case 'login':
          result = await this.executeAction('login', params);
          break;
        case 'logout':
          result = await this.executeAction('logout', params);
          break;

        default:
          // Try to find a registered action handler
          if (this.actionHandlers.has(method)) {
            result = await this.executeAction(method, params);
          } else {
            throw new Error(`Unknown method: ${method}`);
          }
      }

      this.sendResponse(id, result);
      this.logActivity(`→ Response: ${method} OK`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.sendError(id, message);
      this.logActivity(`→ Error: ${method} - ${message}`);
    }
  }

  // ==================== Public API ====================

  /**
   * Expose state for inspection
   */
  exposeState(key: string, getter: StateGetter): void {
    this.stateGetters.set(key, getter);
    if (this.config.debug) {
      console.log(`[MCP SDK] Exposed state: ${key}`);
    }
  }

  /**
   * Register an action handler
   * Actions can be triggered remotely via MCP commands
   */
  registerAction(name: string, handler: ActionHandler): void {
    this.actionHandlers.set(name, handler);
    if (this.config.debug) {
      console.log(`[MCP SDK] Registered action: ${name}`);
    }
  }

  /**
   * Register multiple action handlers at once
   */
  registerActions(actions: Record<string, ActionHandler>): void {
    Object.entries(actions).forEach(([name, handler]) => {
      this.registerAction(name, handler);
    });
  }

  /**
   * Execute a registered action
   */
  private async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    const handler = this.actionHandlers.get(action);
    if (!handler) {
      throw new Error(`Action not registered: ${action}`);
    }
    
    try {
      const result = await handler(params);
      return { success: true, action, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Action failed: ${message}`);
    }
  }

  /**
   * Get list of registered actions
   */
  getRegisteredActions(): string[] {
    return Array.from(this.actionHandlers.keys());
  }

  /**
   * Enable network request interception
   */
  enableNetworkInterception(): void {
    if (this.originalFetch) return;

    this.originalFetch = global.fetch;
    const self = this;

    global.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = Date.now();

      self.networkRequests.push({ id, url, method, timestamp });

      try {
        const response = await self.originalFetch!(input, init);
        const req = self.networkRequests.find((r) => r.id === id);
        if (req) req.status = response.status;
        return response;
      } catch (error) {
        const req = self.networkRequests.find((r) => r.id === id);
        if (req) req.status = 0;
        throw error;
      }
    };

    console.log('[MCP SDK] Network interception enabled');
  }

  /**
   * Enable console log capturing
   */
  enableLogCapture(): void {
    if (this.originalConsole) return;

    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
    };

    const captureLog = (level: string) => {
      return (...args: unknown[]) => {
        // Don't capture our own logs
        const message = args.join(' ');
        if (!message.startsWith('[MCP SDK]')) {
          this.logs.push({
            level,
            message,
            timestamp: Date.now(),
          });
          // Keep only last 1000 logs
          if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-1000);
          }
        }
        this.originalConsole![level as keyof typeof this.originalConsole](...args);
      };
    };

    console.log = captureLog('log');
    console.warn = captureLog('warn');
    console.error = captureLog('error');
    console.info = captureLog('info');

    console.log('[MCP SDK] Log capture enabled');
  }

  /**
   * Register feature flags
   */
  registerFeatureFlags(flags: Record<string, boolean>): void {
    Object.entries(flags).forEach(([key, value]) => {
      this.featureFlags.set(key, value);
    });
    console.log(`[MCP SDK] Registered ${Object.keys(flags).length} feature flags`);
  }

  /**
   * Get feature flag value
   */
  getFeatureFlag(key: string): boolean {
    return this.featureFlags.get(key) ?? false;
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this._isConnected;
  }
  
  /**
   * Get current state
   */
  getState(): MCPState {
    return {
      isConnected: this._isConnected,
      lastActivity: this._lastActivity,
      reconnectCount: this._reconnectCount,
      activityLog: [...this._activityLog],
    };
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(callback: StateCallback): () => void {
    this.stateCallbacks.add(callback);
    // Immediately call with current state
    callback(this.getState());
    // Return unsubscribe function
    return () => {
      this.stateCallbacks.delete(callback);
    };
  }
  
  /**
   * Get activity log
   */
  getActivityLog(): ActivityEntry[] {
    return [...this._activityLog];
  }
  
  /**
   * Get current server URL
   */
  getServerUrl(): string {
    return this.config.serverUrl;
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this._isConnected = false;
    this.logActivity('Disconnected by user');
    this.notifyStateChange();
  }
  
  /**
   * Manually trigger reconnect
   */
  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  // ==================== Private Helpers ====================

  private getAppState(params: Record<string, unknown>): Record<string, unknown> {
    const key = params.key as string | undefined;
    const result: Record<string, unknown> = {};

    if (key) {
      const getter = this.stateGetters.get(key);
      if (getter) {
        result[key] = getter();
      }
    } else {
      this.stateGetters.forEach((getter, k) => {
        try {
          result[k] = getter();
        } catch (e) {
          result[k] = `<error: ${e}>`;
        }
      });
    }

    return result;
  }

  private getFeatureFlags(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    this.featureFlags.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  private toggleFeatureFlag(params: Record<string, unknown>): { key: string; value: boolean } {
    const key = params.key as string;
    if (!key) throw new Error('Feature flag key required');

    const current = this.featureFlags.get(key) ?? false;
    const newValue = params.value !== undefined ? (params.value as boolean) : !current;
    this.featureFlags.set(key, newValue);

    return { key, value: newValue };
  }

  private getNetworkRequests(params: Record<string, unknown>): unknown[] {
    let requests = [...this.networkRequests];
    const limit = (params.limit as number) || 50;

    if (params.url) {
      requests = requests.filter((r) => r.url.includes(params.url as string));
    }
    if (params.method) {
      requests = requests.filter((r) => r.method === params.method);
    }

    return requests.slice(-limit).reverse();
  }

  private getLogs(params: Record<string, unknown>): unknown[] {
    let logs = [...this.logs];
    const limit = (params.limit as number) || 100;

    if (params.level) {
      logs = logs.filter((l) => l.level === params.level);
    }

    return logs.slice(-limit).reverse();
  }

  private getRecentErrors(params: Record<string, unknown>): unknown[] {
    const limit = (params.limit as number) || 20;
    return this.logs
      .filter((l) => l.level === 'error')
      .slice(-limit)
      .reverse();
  }

  private getDeviceInfo(): Record<string, unknown> {
    const { Platform, Dimensions } = require('react-native');
    const { width, height } = Dimensions.get('window');

    return {
      platform: Platform.OS,
      version: Platform.Version,
      isTV: Platform.isTV,
      screenSize: { width, height },
    };
  }

  private getAppInfo(): Record<string, unknown> {
    return {
      name: 'MCP Demo Store',
      version: '1.0.0',
      buildNumber: '1',
      bundleId: 'com.mobiledevmcp.demo',
      environment: __DEV__ ? 'development' : 'production',
    };
  }
}

// Export singleton instance
export const MCPBridge = new MCPBridgeClass();
