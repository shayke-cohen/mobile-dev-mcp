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

// Component registration for testIds
interface RegisteredComponent {
  testId: string;
  type: string;
  props?: Record<string, unknown>;
  bounds?: { x: number; y: number; width: number; height: number };
  onPress?: () => void;
  onChangeText?: (text: string) => void;
  getText?: () => string;
  children?: string[];
}

// Network mock configuration
interface NetworkMock {
  id: string;
  urlPattern: RegExp;
  response: {
    statusCode: number;
    body: unknown;
    headers?: Record<string, string>;
    delay?: number;
  };
}

// Tracing types
interface TraceInfo {
  args?: Record<string, unknown>;
  file?: string;
  startTime?: number;
  metadata?: Record<string, unknown>;
}

interface TraceEntry {
  id: string;
  name: string;
  info: TraceInfo;
  timestamp: number;
  duration?: number;
  returnValue?: unknown;
  error?: string;
  completed: boolean;
}

interface TraceFilter {
  name?: string;
  file?: string;
  minDuration?: number;
  since?: number;
  limit?: number;
  inProgress?: boolean;
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
    duration?: number;
    requestBody?: unknown;
    responseBody?: unknown;
    timestamp: number;
  }> = [];
  private featureFlags: Map<string, boolean> = new Map();
  
  // New: Component registry for UI inspection
  private components: Map<string, RegisteredComponent> = new Map();
  
  // New: Network mocking
  private networkMocks: Map<string, NetworkMock> = new Map();
  
  // New: Navigation state
  private navigationState: {
    currentRoute: string;
    params?: Record<string, unknown>;
    history: Array<{ route: string; timestamp: number }>;
  } = {
    currentRoute: 'home',
    history: [],
  };
  
  // Tracing
  private traces: Map<string, TraceEntry> = new Map();
  private traceHistory: TraceEntry[] = [];
  private traceIdCounter = 0;
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
          capabilities: ['state', 'logs', 'network', 'featureFlags', 'actions', 'ui', 'tracing'],
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

        // UI inspection commands
        case 'get_component_tree':
          result = this.getComponentTree(params);
          break;
        case 'get_layout_tree':
          result = this.getLayoutTree(params);
          break;
        case 'inspect_element':
          result = this.inspectElement(params);
          break;
        case 'find_element':
          result = this.findElement(params);
          break;
        case 'get_element_text':
          result = this.getElementText(params);
          break;
        case 'simulate_interaction':
          result = await this.simulateInteraction(params);
          break;
        
        // Navigation commands
        case 'get_navigation_state':
          result = this.getNavigationState();
          break;
        
        // Storage commands
        case 'query_storage':
          result = await this.queryStorage(params);
          break;
        
        // Network mocking commands
        case 'mock_network_request':
          result = this.mockNetworkRequest(params);
          break;
        case 'clear_network_mocks':
          result = this.clearNetworkMocks(params);
          break;
        case 'replay_network_request':
          result = await this.replayNetworkRequest(params);
          break;

        // Tracing commands
        case 'get_traces':
          result = this.getTraces(params as TraceFilter);
          break;
        case 'get_active_traces':
          result = this.getTraces({ inProgress: true });
          break;
        case 'clear_traces':
          this.clearTraces();
          result = { success: true };
          break;
        
        // Dynamic instrumentation commands (Debug Mode)
        case 'inject_trace':
          result = {
            id: this.injectTrace(
              params.pattern as string,
              { logArgs: params.logArgs as boolean, logReturn: params.logReturn as boolean }
            ),
            success: true,
          };
          break;
        case 'remove_trace':
          result = { success: this.removeTrace(params.id as string) };
          break;
        case 'clear_injected_traces':
          result = { cleared: this.clearInjectedTraces(), success: true };
          break;
        case 'list_injected_traces':
          result = { traces: this.listInjectedTraces() };
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

  // ==================== Tracing API ====================

  /**
   * Trace a function call (called at function entry)
   * Used by the Babel plugin for auto-instrumentation
   */
  trace(name: string, info: TraceInfo = {}): string {
    if (typeof __DEV__ !== 'undefined' && !__DEV__) {
      return '';
    }

    const id = `trace_${++this.traceIdCounter}_${Date.now()}`;
    const entry: TraceEntry = {
      id,
      name,
      info,
      timestamp: info.startTime || Date.now(),
      completed: false,
    };

    this.traces.set(id, entry);
    this.traces.set(`name:${name}`, entry);

    if (this.config.debug) {
      console.log(`[MCP Trace] → ${name}`, info.args || {});
    }

    return id;
  }

  /**
   * Complete a trace (called at function exit)
   * Used by the Babel plugin for auto-instrumentation
   */
  traceReturn(name: string, returnValue?: unknown, error?: string): void {
    if (typeof __DEV__ !== 'undefined' && !__DEV__) {
      return;
    }

    const entry = this.traces.get(`name:${name}`);
    if (!entry) {
      return;
    }

    const now = Date.now();
    entry.duration = now - entry.timestamp;
    entry.returnValue = returnValue;
    entry.error = error;
    entry.completed = true;

    this.traceHistory.push(entry);
    if (this.traceHistory.length > 1000) {
      this.traceHistory = this.traceHistory.slice(-1000);
    }

    this.traces.delete(entry.id);
    this.traces.delete(`name:${name}`);

    if (this.config.debug) {
      const status = error ? `✗ ${error}` : '✓';
      console.log(`[MCP Trace] ← ${name} (${entry.duration}ms) ${status}`);
    }
  }

  /**
   * Trace an async function with automatic entry/exit tracking
   */
  async traceAsync<T>(
    name: string,
    fn: () => Promise<T>,
    info: TraceInfo = {}
  ): Promise<T> {
    this.trace(name, { ...info, startTime: Date.now() });
    try {
      const result = await fn();
      this.traceReturn(name, result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.traceReturn(name, undefined, message);
      throw error;
    }
  }

  /**
   * Trace a synchronous function
   */
  traceSync<T>(name: string, fn: () => T, info: TraceInfo = {}): T {
    this.trace(name, { ...info, startTime: Date.now() });
    try {
      const result = fn();
      this.traceReturn(name, result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.traceReturn(name, undefined, message);
      throw error;
    }
  }

  /**
   * Get trace history with optional filtering
   */
  getTraces(filter: TraceFilter = {}): { traces: TraceEntry[]; count: number; activeCount: number } {
    let traces = [...this.traceHistory];

    if (filter.name) {
      const pattern = new RegExp(filter.name, 'i');
      traces = traces.filter(t => pattern.test(t.name));
    }

    if (filter.file) {
      const pattern = new RegExp(filter.file, 'i');
      traces = traces.filter(t => t.info.file && pattern.test(t.info.file));
    }

    if (filter.minDuration !== undefined) {
      traces = traces.filter(t => (t.duration || 0) >= filter.minDuration!);
    }

    if (filter.since !== undefined) {
      const since = Date.now() - filter.since;
      traces = traces.filter(t => t.timestamp >= since);
    }

    if (filter.inProgress) {
      traces = Array.from(this.traces.values()).filter(t => !t.id.startsWith('name:'));
    }

    const limit = filter.limit || 100;
    return {
      traces: traces.slice(-limit).reverse(),
      count: traces.length,
      activeCount: Math.floor(this.traces.size / 2),
    };
  }

  /**
   * Clear trace history
   */
  clearTraces(): void {
    this.traces.clear();
    this.traceHistory = [];
  }

  // ==================== Dynamic Instrumentation API ====================

  private injectedTraces: Map<string, {
    pattern: RegExp;
    logArgs: boolean;
    logReturn: boolean;
    active: boolean;
  }> = new Map();

  /**
   * Inject a trace point at runtime (for Debug Mode)
   */
  injectTrace(
    pattern: string,
    options: { logArgs?: boolean; logReturn?: boolean } = {}
  ): string {
    const id = `inject_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    
    this.injectedTraces.set(id, {
      pattern: new RegExp(`^${regexPattern}$`),
      logArgs: options.logArgs !== false,
      logReturn: options.logReturn !== false,
      active: true,
    });

    if (this.config.debug) {
      console.log(`[MCP Debug] Injected trace: ${pattern} (id: ${id})`);
    }

    return id;
  }

  removeTrace(id: string): boolean {
    return this.injectedTraces.delete(id);
  }

  clearInjectedTraces(): number {
    const count = this.injectedTraces.size;
    this.injectedTraces.clear();
    return count;
  }

  listInjectedTraces(): Array<{ id: string; pattern: string; active: boolean }> {
    return Array.from(this.injectedTraces.entries()).map(([id, config]) => ({
      id,
      pattern: config.pattern.source,
      active: config.active,
    }));
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

  // ==================== Component Registration ====================

  /**
   * Register a component for UI inspection and interaction
   */
  registerComponent(
    testId: string,
    config: {
      type: string;
      props?: Record<string, unknown>;
      bounds?: { x: number; y: number; width: number; height: number };
      onPress?: () => void;
      onChangeText?: (text: string) => void;
      getText?: () => string;
      children?: string[];
    }
  ): void {
    this.components.set(testId, { testId, ...config });
    if (this.config.debug) {
      console.log(`[MCP SDK] Registered component: ${testId}`);
    }
  }

  /**
   * Unregister a component
   */
  unregisterComponent(testId: string): void {
    this.components.delete(testId);
  }

  /**
   * Update component bounds (call from onLayout)
   */
  updateComponentBounds(
    testId: string,
    bounds: { x: number; y: number; width: number; height: number }
  ): void {
    const component = this.components.get(testId);
    if (component) {
      component.bounds = bounds;
    }
  }

  // ==================== UI Inspection Commands ====================

  private getComponentTree(params: Record<string, unknown>): Record<string, unknown> {
    const includeProps = params.includeProps !== false;
    const depth = (params.depth as number) || 10;
    
    const components = Array.from(this.components.values()).map(comp => ({
      testId: comp.testId,
      type: comp.type,
      ...(includeProps && comp.props ? { props: comp.props } : {}),
      bounds: comp.bounds,
      hasOnPress: !!comp.onPress,
      hasOnChangeText: !!comp.onChangeText,
      children: comp.children,
    }));

    return {
      componentCount: components.length,
      components,
      registeredTestIds: Array.from(this.components.keys()),
    };
  }

  private getLayoutTree(params: Record<string, unknown>): Record<string, unknown> {
    const includeHidden = params.includeHidden === true;
    
    const elements = Array.from(this.components.values())
      .filter(comp => includeHidden || comp.bounds)
      .map(comp => ({
        testId: comp.testId,
        type: comp.type,
        bounds: comp.bounds || { x: 0, y: 0, width: 0, height: 0 },
        visible: !!comp.bounds,
      }));

    return {
      elementCount: elements.length,
      elements,
    };
  }

  private inspectElement(params: Record<string, unknown>): Record<string, unknown> {
    const x = params.x as number;
    const y = params.y as number;

    // Find element at coordinates
    for (const comp of this.components.values()) {
      if (comp.bounds) {
        const { x: bx, y: by, width, height } = comp.bounds;
        if (x >= bx && x <= bx + width && y >= by && y <= by + height) {
          return {
            found: true,
            testId: comp.testId,
            type: comp.type,
            bounds: comp.bounds,
            props: comp.props,
            text: comp.getText?.(),
            interactive: !!(comp.onPress || comp.onChangeText),
          };
        }
      }
    }

    return { found: false, x, y };
  }

  private findElement(params: Record<string, unknown>): Record<string, unknown> {
    const testId = params.testId as string;
    const type = params.type as string;
    const text = params.text as string;

    const results: Array<Record<string, unknown>> = [];

    for (const comp of this.components.values()) {
      let match = true;
      
      if (testId && comp.testId !== testId) match = false;
      if (type && comp.type !== type) match = false;
      if (text && comp.getText?.() !== text) match = false;

      if (match) {
        results.push({
          testId: comp.testId,
          type: comp.type,
          bounds: comp.bounds,
          text: comp.getText?.(),
        });
      }
    }

    return {
      found: results.length > 0,
      count: results.length,
      elements: results,
    };
  }

  private getElementText(params: Record<string, unknown>): Record<string, unknown> {
    const testId = params.testId as string;
    const comp = this.components.get(testId);

    if (!comp) {
      return { found: false, testId };
    }

    return {
      found: true,
      testId,
      text: comp.getText?.() ?? null,
      type: comp.type,
    };
  }

  private async simulateInteraction(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const type = params.type as string;
    const target = params.target as Record<string, unknown>;
    const value = params.value as string;

    let component: RegisteredComponent | undefined;

    // Find target component
    if (target.testId) {
      component = this.components.get(target.testId as string);
    } else if (target.x !== undefined && target.y !== undefined) {
      // Find by coordinates
      for (const comp of this.components.values()) {
        if (comp.bounds) {
          const { x, y, width, height } = comp.bounds;
          if (
            (target.x as number) >= x &&
            (target.x as number) <= x + width &&
            (target.y as number) >= y &&
            (target.y as number) <= y + height
          ) {
            component = comp;
            break;
          }
        }
      }
    }

    if (!component) {
      return {
        success: false,
        error: 'Element not found',
        target,
      };
    }

    switch (type) {
      case 'tap':
      case 'press':
        if (component.onPress) {
          component.onPress();
          return { success: true, action: 'tap', testId: component.testId };
        }
        return { success: false, error: 'Element is not pressable', testId: component.testId };

      case 'longPress':
        if (component.onPress) {
          component.onPress();
          return { success: true, action: 'longPress', testId: component.testId };
        }
        return { success: false, error: 'Element is not pressable', testId: component.testId };

      case 'input':
      case 'type':
        if (component.onChangeText && value) {
          component.onChangeText(value);
          return { success: true, action: 'input', testId: component.testId, value };
        }
        return { success: false, error: 'Element does not accept text input', testId: component.testId };

      default:
        return { success: false, error: `Unknown interaction type: ${type}` };
    }
  }

  // ==================== Navigation State ====================

  /**
   * Set current navigation state (call from navigation listener)
   */
  setNavigationState(route: string, params?: Record<string, unknown>): void {
    this.navigationState.history.push({
      route: this.navigationState.currentRoute,
      timestamp: Date.now(),
    });
    this.navigationState.currentRoute = route;
    this.navigationState.params = params;
    
    // Keep last 20 history entries
    if (this.navigationState.history.length > 20) {
      this.navigationState.history = this.navigationState.history.slice(-20);
    }
  }

  private getNavigationState(): Record<string, unknown> {
    return {
      currentRoute: this.navigationState.currentRoute,
      params: this.navigationState.params,
      history: this.navigationState.history,
      historyLength: this.navigationState.history.length,
    };
  }

  // ==================== Storage Query ====================

  private async queryStorage(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const key = params.key as string | undefined;
      const pattern = params.pattern as string | undefined;

      if (key) {
        // Get specific key
        const value = await AsyncStorage.getItem(key);
        return {
          key,
          value: value ? JSON.parse(value) : null,
          exists: value !== null,
        };
      }

      // Get all keys
      const allKeys = await AsyncStorage.getAllKeys();
      let keys = allKeys;

      if (pattern) {
        const regex = new RegExp(pattern);
        keys = allKeys.filter((k: string) => regex.test(k));
      }

      const pairs = await AsyncStorage.multiGet(keys);
      const storage: Record<string, unknown> = {};
      
      for (const [k, v] of pairs) {
        try {
          storage[k] = v ? JSON.parse(v) : null;
        } catch {
          storage[k] = v;
        }
      }

      return {
        keyCount: keys.length,
        keys,
        storage,
      };
    } catch (error) {
      return {
        error: 'AsyncStorage not available or error occurred',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==================== Network Mocking ====================

  private mockNetworkRequest(params: Record<string, unknown>): Record<string, unknown> {
    const urlPattern = params.urlPattern as string;
    const mockResponse = params.mockResponse as {
      statusCode: number;
      body: unknown;
      headers?: Record<string, string>;
      delay?: number;
    };

    const mockId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.networkMocks.set(mockId, {
      id: mockId,
      urlPattern: new RegExp(urlPattern),
      response: mockResponse,
    });

    return {
      success: true,
      mockId,
      urlPattern,
      activeМocks: this.networkMocks.size,
    };
  }

  private clearNetworkMocks(params: Record<string, unknown>): Record<string, unknown> {
    const mockId = params.mockId as string | undefined;

    if (mockId) {
      const deleted = this.networkMocks.delete(mockId);
      return { success: deleted, mockId, remainingMocks: this.networkMocks.size };
    }

    const count = this.networkMocks.size;
    this.networkMocks.clear();
    return { success: true, clearedCount: count, remainingMocks: 0 };
  }

  private async replayNetworkRequest(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const requestId = params.requestId as string;
    const modifications = params.modifications as Record<string, unknown> | undefined;

    const request = this.networkRequests.find(r => r.id === requestId);
    if (!request) {
      return { success: false, error: 'Request not found', requestId };
    }

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: modifications?.headers as Record<string, string> | undefined,
        body: modifications?.body ? JSON.stringify(modifications.body) : undefined,
      });

      const body = await response.json().catch(() => response.text());

      return {
        success: true,
        requestId,
        status: response.status,
        body,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      };
    }
  }

  /**
   * Check if a URL matches any mock
   */
  private getMatchingMock(url: string): NetworkMock | undefined {
    for (const mock of this.networkMocks.values()) {
      if (mock.urlPattern.test(url)) {
        return mock;
      }
    }
    return undefined;
  }
}

// Export singleton instance
export const MCPBridge = new MCPBridgeClass();
