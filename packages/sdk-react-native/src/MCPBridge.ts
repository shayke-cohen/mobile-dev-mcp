/**
 * MCPBridge - Main SDK class for React Native
 * 
 * Connects your React Native app to the MCP server for AI-assisted development.
 */

import { StateAdapter } from './adapters/StateAdapter';
import { NetworkAdapter } from './adapters/NetworkAdapter';
import { LogAdapter } from './adapters/LogAdapter';
import { UIAdapter } from './adapters/UIAdapter';
import { WebSocketClient } from './connection/WebSocketClient';
import type { MCPConfig, MCPCommand, StateGetter } from './types';

// Check if we're in development mode
declare const __DEV__: boolean;

class MCPBridgeClass {
  private wsClient: WebSocketClient | null = null;
  private stateAdapter: StateAdapter;
  private networkAdapter: NetworkAdapter;
  private logAdapter: LogAdapter;
  private uiAdapter: UIAdapter;
  private initialized = false;
  private config: Required<MCPConfig>;

  constructor() {
    this.stateAdapter = new StateAdapter();
    this.networkAdapter = new NetworkAdapter();
    this.logAdapter = new LogAdapter();
    this.uiAdapter = new UIAdapter();
    this.config = {
      serverUrl: 'ws://localhost:8765',
      autoConnect: true,
      reconnectInterval: 3000,
      timeout: 10000,
      debug: false,
    };
  }

  /**
   * Initialize the MCP SDK
   * 
   * @example
   * ```typescript
   * MCPBridge.initialize({
   *   serverUrl: 'ws://localhost:8765',
   *   autoConnect: true
   * });
   * ```
   */
  initialize(config: MCPConfig = {}): void {
    // Only run in development
    if (typeof __DEV__ !== 'undefined' && !__DEV__) {
      this.log('warn', 'MCP SDK only works in development mode. Skipping initialization.');
      return;
    }

    if (this.initialized) {
      this.log('warn', 'MCP SDK already initialized');
      return;
    }

    this.config = { ...this.config, ...config };
    
    this.wsClient = new WebSocketClient({
      url: this.config.serverUrl,
      reconnectInterval: this.config.reconnectInterval,
      timeout: this.config.timeout,
      debug: this.config.debug,
      onCommand: this.handleCommand.bind(this),
    });

    if (this.config.autoConnect) {
      this.wsClient.connect();
    }

    this.initialized = true;
    this.log('info', `MCP SDK initialized, connecting to ${this.config.serverUrl}`);
  }

  /**
   * Handle incoming command from MCP server
   */
  private async handleCommand(command: MCPCommand): Promise<unknown> {
    const { method, params = {} } = command;

    this.log('debug', `Received command: ${method}`, params);

    try {
      switch (method) {
        // State tools
        case 'get_app_state':
          return this.stateAdapter.getState(params);
        case 'query_storage':
          return this.stateAdapter.queryStorage(params);
        case 'get_navigation_state':
          return this.stateAdapter.getNavigationState();

        // Network tools
        case 'list_network_requests':
          return this.networkAdapter.listRequests(params);
        case 'mock_network_request':
          return this.networkAdapter.mockRequest(params);
        case 'clear_network_mocks':
          return this.networkAdapter.clearMocks(params);

        // Log tools
        case 'get_logs':
          return this.logAdapter.getLogs(params);
        case 'get_recent_errors':
          return this.logAdapter.getRecentErrors(params);
        case 'get_function_trace':
          return this.logAdapter.getFunctionTrace(params);

        // UI tools
        case 'capture_screenshot':
          return this.uiAdapter.captureScreenshot(params);
        case 'get_component_tree':
          return this.uiAdapter.getComponentTree(params);
        case 'get_layout_tree':
          return this.uiAdapter.getLayoutTree(params);
        case 'simulate_interaction':
          return this.uiAdapter.simulateInteraction(params);
        case 'navigate_to':
          return this.uiAdapter.navigateTo(params);

        // Device tools
        case 'get_device_info':
          return this.getDeviceInfo();
        case 'get_app_info':
          return this.getAppInfo();
        case 'list_feature_flags':
          return this.stateAdapter.getFeatureFlags();
        case 'toggle_feature_flag':
          return this.stateAdapter.toggleFeatureFlag(params);

        default:
          throw new Error(`Unknown method: ${method}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', `Command failed: ${method}`, message);
      throw error;
    }
  }

  // ================== Public API ==================

  /**
   * Expose application state for inspection
   * 
   * @example
   * ```typescript
   * // Expose Redux store
   * MCPBridge.exposeState('store', () => store.getState());
   * 
   * // Expose specific state
   * MCPBridge.exposeState('user', () => store.getState().user);
   * ```
   */
  exposeState(key: string, getter: StateGetter): void {
    this.stateAdapter.expose(key, getter);
    this.log('debug', `Exposed state: ${key}`);
  }

  /**
   * Connect Redux or Zustand store for automatic state exposure
   * 
   * @example
   * ```typescript
   * MCPBridge.connectStore(store);
   * ```
   */
  connectStore(store: { getState: () => unknown; subscribe?: (listener: () => void) => void }): void {
    this.stateAdapter.connectStore(store);
    this.log('info', 'Store connected');
  }

  /**
   * Set navigation ref for navigation state inspection
   * 
   * @example
   * ```typescript
   * MCPBridge.setNavigationRef(navigationRef);
   * ```
   */
  setNavigationRef(ref: { current: unknown }): void {
    this.stateAdapter.setNavigationRef(ref);
    this.log('info', 'Navigation ref set');
  }

  /**
   * Enable network request interception
   * 
   * @example
   * ```typescript
   * MCPBridge.enableNetworkInterception();
   * ```
   */
  enableNetworkInterception(): void {
    this.networkAdapter.enable();
    this.log('info', 'Network interception enabled');
  }

  /**
   * Enable console log capturing
   */
  enableLogCapture(): void {
    this.logAdapter.enable();
    this.log('info', 'Log capture enabled');
  }

  /**
   * Register feature flags for runtime toggling
   */
  registerFeatureFlags(flags: Record<string, boolean>): void {
    this.stateAdapter.registerFeatureFlags(flags);
    this.log('info', `Registered ${Object.keys(flags).length} feature flags`);
  }

  /**
   * Log a trace entry (for function tracing)
   */
  trace(functionName: string, type: 'enter' | 'exit' | 'error', data?: unknown): void {
    this.logAdapter.addTrace(functionName, type, data);
  }

  /**
   * Log function return value (for function tracing)
   */
  traceReturn<T>(functionName: string, result: T): T {
    this.logAdapter.addTrace(functionName, 'exit', result);
    return result;
  }

  /**
   * Manually connect to MCP server (if autoConnect is false)
   */
  connect(): void {
    this.wsClient?.connect();
  }

  /**
   * Disconnect from MCP server
   */
  disconnect(): void {
    this.wsClient?.disconnect();
  }

  /**
   * Check if connected to MCP server
   */
  isConnected(): boolean {
    return this.wsClient?.isConnected() ?? false;
  }

  // ================== Private Helpers ==================

  private getDeviceInfo(): Record<string, unknown> {
    const { Platform, Dimensions } = require('react-native');
    const { width, height } = Dimensions.get('window');
    
    return {
      platform: Platform.OS,
      version: Platform.Version,
      isTV: Platform.isTV,
      screenSize: { width, height },
      // Add more device info as needed
    };
  }

  private getAppInfo(): Record<string, unknown> {
    // This would typically come from app.json or native modules
    return {
      name: 'Unknown', // Would be populated from native
      version: '0.0.0',
      buildNumber: '0',
      bundleId: 'unknown',
      environment: __DEV__ ? 'development' : 'production',
    };
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: unknown[]): void {
    if (!this.config.debug && level === 'debug') return;
    console[level](`[MCP SDK] ${message}`, ...args);
  }
}

// Export singleton instance
export const MCPBridge = new MCPBridgeClass();
