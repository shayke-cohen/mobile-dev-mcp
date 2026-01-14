/**
 * MCP Bridge - React Web SDK
 * 
 * Connects React web applications to the MCP server for AI-assisted development.
 * Provides state exposure, action registration, UI inspection, and tracing.
 */

// Types
export interface TraceInfo {
  args?: Record<string, unknown>;
  file?: string;
  startTime?: number;
}

export interface TraceEntry {
  id: string;
  name: string;
  info?: TraceInfo;
  timestamp: number;
  duration?: number;
  returnValue?: unknown;
  error?: string;
  completed: boolean;
}

export interface RegisteredComponent {
  testId: string;
  type: string;
  element?: HTMLElement;
  props?: Record<string, unknown>;
  getText?: () => string | null;
  onTap?: () => void;
}

export interface NavigationState {
  currentRoute: string;
  params?: Record<string, unknown>;
  history: Array<{ route: string; timestamp: string }>;
}

export interface NetworkMock {
  id: string;
  urlPattern: string;
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
  delay?: number;
}

export interface MCPBridgeOptions {
  serverUrl?: string;
  debug?: boolean;
  autoConnect?: boolean;
}

type StateGetter = () => unknown;
type ActionHandler = (params: Record<string, unknown>) => unknown | Promise<unknown>;

class MCPBridgeClass {
  private ws: WebSocket | null = null;
  private serverUrl = 'ws://localhost:8765';
  private debug = false;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  // State management
  private stateGetters = new Map<string, StateGetter>();
  private actionHandlers = new Map<string, ActionHandler>();
  private featureFlags = new Map<string, boolean>();
  private logs: Array<Record<string, unknown>> = [];
  private networkRequests: Array<Record<string, unknown>> = [];

  // UI Components
  private components = new Map<string, RegisteredComponent>();

  // Navigation
  private navigationState: NavigationState = {
    currentRoute: '/',
    params: undefined,
    history: [],
  };

  // Network mocking
  private networkMocks = new Map<string, NetworkMock>();
  private originalFetch: typeof fetch | null = null;

  // Tracing
  private activeTraces = new Map<string, TraceEntry>();
  private traceHistory: TraceEntry[] = [];
  private traceIdCounter = 0;
  private injectedTraces = new Map<string, { pattern: string; logArgs: boolean; logReturn: boolean; createdAt: number }>();

  // Event listeners
  private listeners = new Map<string, Set<(data: unknown) => void>>();

  /**
   * Initialize the MCP Bridge
   */
  initialize(options: MCPBridgeOptions = {}): void {
    if (typeof window === 'undefined') {
      console.warn('[MCP] MCPBridge requires a browser environment');
      return;
    }

    // Only run in development
    if (process.env.NODE_ENV === 'production') {
      console.log('[MCP] MCPBridge disabled in production');
      return;
    }

    this.serverUrl = options.serverUrl || 'ws://localhost:8765';
    this.debug = options.debug ?? false;

    if (options.autoConnect !== false) {
      this.connect();
    }

    // Intercept console for log capture
    this.interceptConsole();

    // Intercept fetch for network monitoring
    this.interceptFetch();

    this.log('MCP Bridge initialized');
  }

  /**
   * Connect to the MCP server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.log('Connected to MCP server');
        this.sendHandshake();
        this.emit('connected', null);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (e) {
          console.error('[MCP] Failed to parse message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.log('Disconnected from MCP server');
        this.emit('disconnected', null);
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[MCP] WebSocket error:', error);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('[MCP] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the MCP server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Check if connected to the MCP server
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  // ==================== State Exposure ====================

  /**
   * Expose state for AI inspection
   */
  exposeState(key: string, getter: StateGetter): void {
    this.stateGetters.set(key, getter);
    this.log(`Exposed state: ${key}`);
  }

  /**
   * Remove exposed state
   */
  removeState(key: string): void {
    this.stateGetters.delete(key);
  }

  // ==================== Action Registration ====================

  /**
   * Register an action that AI can trigger
   */
  registerAction(name: string, handler: ActionHandler): void {
    this.actionHandlers.set(name, handler);
    this.log(`Registered action: ${name}`);
  }

  /**
   * Remove a registered action
   */
  removeAction(name: string): void {
    this.actionHandlers.delete(name);
  }

  // ==================== Component Registration ====================

  /**
   * Register a UI component for AI inspection
   */
  registerComponent(
    testId: string,
    type: string,
    options: {
      element?: HTMLElement;
      props?: Record<string, unknown>;
      getText?: () => string | null;
      onTap?: () => void;
    } = {}
  ): void {
    this.components.set(testId, {
      testId,
      type,
      ...options,
    });
  }

  /**
   * Unregister a component
   */
  unregisterComponent(testId: string): void {
    this.components.delete(testId);
  }

  /**
   * Update component element reference
   */
  updateComponentElement(testId: string, element: HTMLElement | null): void {
    const comp = this.components.get(testId);
    if (comp && element) {
      comp.element = element;
    }
  }

  // ==================== Navigation ====================

  /**
   * Set the current navigation state
   */
  setNavigationState(route: string, params?: Record<string, unknown>): void {
    this.navigationState.currentRoute = route;
    this.navigationState.params = params;
    this.navigationState.history.push({
      route,
      timestamp: new Date().toISOString(),
    });

    // Keep history limited
    if (this.navigationState.history.length > 50) {
      this.navigationState.history.shift();
    }

    this.log(`Navigation: ${route}`);
  }

  // ==================== Feature Flags ====================

  /**
   * Register feature flags
   */
  registerFeatureFlags(flags: Record<string, boolean>): void {
    for (const [key, value] of Object.entries(flags)) {
      this.featureFlags.set(key, value);
    }
  }

  /**
   * Get a feature flag value
   */
  getFeatureFlag(key: string): boolean {
    return this.featureFlags.get(key) ?? false;
  }

  // ==================== Tracing ====================

  /**
   * Start a trace for a function
   */
  trace(name: string, info: TraceInfo = {}): string {
    this.traceIdCounter++;
    const id = `trace_${this.traceIdCounter}_${Date.now()}`;

    const entry: TraceEntry = {
      id,
      name,
      info,
      timestamp: info.startTime || Date.now(),
      completed: false,
    };

    this.activeTraces.set(id, entry);
    this.activeTraces.set(`name:${name}`, entry);

    return id;
  }

  /**
   * Complete a trace
   */
  traceReturn(name: string, returnValue?: unknown, error?: string): void {
    const entry = this.activeTraces.get(`name:${name}`);
    if (!entry) return;

    const now = Date.now();
    entry.duration = now - entry.timestamp;
    entry.returnValue = returnValue;
    entry.error = error;
    entry.completed = true;

    this.traceHistory.push(entry);
    if (this.traceHistory.length > 1000) {
      this.traceHistory.shift();
    }

    this.activeTraces.delete(entry.id);
    this.activeTraces.delete(`name:${name}`);
  }

  /**
   * Trace an async function
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
      this.traceReturn(name, undefined, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Trace a sync function
   */
  traceSync<T>(name: string, fn: () => T, info: TraceInfo = {}): T {
    this.trace(name, { ...info, startTime: Date.now() });
    try {
      const result = fn();
      this.traceReturn(name, result);
      return result;
    } catch (error) {
      this.traceReturn(name, undefined, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // ==================== Event Handling ====================

  /**
   * Subscribe to an event
   */
  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  // ==================== Internal Methods ====================

  private log(message: string): void {
    if (this.debug) {
      console.log(`[MCP] ${message}`);
    }
  }

  private sendHandshake(): void {
    this.send({
      type: 'handshake',
      platform: 'web',
      appName: document.title || 'React Web App',
      deviceId: this.getDeviceId(),
      osVersion: navigator.userAgent,
      sdkVersion: '0.1.0',
      capabilities: ['state', 'actions', 'ui', 'network', 'logs', 'tracing'],
    });
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('mcp_device_id');
    if (!deviceId) {
      deviceId = `web_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('mcp_device_id', deviceId);
    }
    return deviceId;
  }

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[MCP] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    this.reconnectTimer = setTimeout(() => {
      this.log(`Reconnecting (attempt ${this.reconnectAttempts})...`);
      this.connect();
    }, delay);
  }

  private handleMessage(message: Record<string, unknown>): void {
    const { id, method, params } = message as {
      id?: number;
      method?: string;
      params?: Record<string, unknown>;
    };

    if (method && id !== undefined) {
      // It's a request
      this.handleRequest(id, method, params || {});
    } else if (id !== undefined) {
      // It's a response
      const pending = this.pendingRequests.get(id);
      if (pending) {
        this.pendingRequests.delete(id);
        if ((message as { error?: unknown }).error) {
          pending.reject(new Error(String((message as { error?: unknown }).error)));
        } else {
          pending.resolve((message as { result?: unknown }).result);
        }
      }
    }
  }

  private async handleRequest(
    id: number,
    method: string,
    params: Record<string, unknown>
  ): Promise<void> {
    try {
      const result = await this.handleCommand(method, params);
      this.send({ id, result });
    } catch (error) {
      this.send({
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleCommand(
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    switch (method) {
      case 'get_app_state':
        return this.getAppState(params);
      case 'get_device_info':
        return this.getDeviceInfo();
      case 'list_feature_flags':
        return Object.fromEntries(this.featureFlags);
      case 'toggle_feature_flag':
        return this.toggleFeatureFlag(params);
      case 'get_logs':
        return this.getLogs(params);
      case 'get_recent_errors':
        return this.getRecentErrors(params);
      case 'list_network_requests':
        return this.networkRequests.slice(-(params.limit as number || 50));
      case 'get_component_tree':
        return this.getComponentTree(params);
      case 'get_layout_tree':
        return this.getLayoutTree(params);
      case 'find_element':
        return this.findElement(params);
      case 'get_element_text':
        return this.getElementText(params);
      case 'simulate_interaction':
        return this.simulateInteraction(params);
      case 'capture_screenshot':
        return this.captureScreenshot(params);
      case 'inspect_element':
        return this.inspectElement(params);
      case 'get_navigation_state':
        return this.getNavigationState();
      case 'query_storage':
        return this.queryStorage(params);
      case 'mock_network_request':
        return this.mockNetworkRequest(params);
      case 'clear_network_mocks':
        return this.clearNetworkMocks();
      case 'list_actions':
        return this.getRegisteredActions();
      case 'execute_action':
        return this.executeAction(params.action as string, params);
      case 'navigate_to':
        return this.executeAction('navigate', params);
      case 'add_to_cart':
        return this.executeAction('addToCart', params);
      case 'remove_from_cart':
        return this.executeAction('removeFromCart', params);
      case 'clear_cart':
        return this.executeAction('clearCart', params);
      case 'login':
        return this.executeAction('login', params);
      case 'logout':
        return this.executeAction('logout', params);

      // Tracing commands
      case 'get_traces':
        return this.getTraces(params);
      case 'get_active_traces':
        return this.getTraces({ inProgress: true });
      case 'clear_traces':
        this.clearTraces();
        return { success: true };
      case 'inject_trace':
        return this.injectTrace(params);
      case 'remove_trace':
        return this.removeInjectedTrace(params);
      case 'clear_injected_traces':
        this.injectedTraces.clear();
        return { success: true };
      case 'list_injected_traces':
        return this.listInjectedTraces();

      default:
        // Try action handlers
        if (this.actionHandlers.has(method)) {
          return this.executeAction(method, params);
        }
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private getAppState(params: Record<string, unknown>): unknown {
    const path = params.path as string | undefined;
    const keys = params.keys as string[] | undefined;

    // If a specific path is requested, return just that value
    if (path) {
      // Handle dot notation paths like "user.profile"
      const parts = path.split('.');
      const rootKey = parts[0];
      const getter = this.stateGetters.get(rootKey);
      
      if (getter) {
        try {
          let value = getter();
          // Navigate nested path
          for (let i = 1; i < parts.length && value != null; i++) {
            value = (value as Record<string, unknown>)[parts[i]];
          }
          return value;
        } catch (_e) {
          return null;
        }
      }
      return null;
    }

    // Return all requested keys or all available state
    const result: Record<string, unknown> = {};
    const keysToGet = keys || Array.from(this.stateGetters.keys());
    for (const key of keysToGet) {
      const getter = this.stateGetters.get(key);
      if (getter) {
        try {
          result[key] = getter();
        } catch (_e) {
          result[key] = null;
        }
      }
    }

    return result;
  }

  private getDeviceInfo(): Record<string, unknown> {
    return {
      platform: 'web',
      osVersion: navigator.userAgent,
      appVersion: '1.0.0',
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      language: navigator.language,
      online: navigator.onLine,
      url: window.location.href,
    };
  }

  private toggleFeatureFlag(params: Record<string, unknown>): Record<string, unknown> {
    const key = params.key as string;
    const value = params.value as boolean | undefined;

    if (value !== undefined) {
      this.featureFlags.set(key, value);
    } else {
      this.featureFlags.set(key, !this.featureFlags.get(key));
    }

    return { key, value: this.featureFlags.get(key) };
  }

  private getLogs(params: Record<string, unknown>): Record<string, unknown> {
    const limit = (params.limit as number) || 100;
    return {
      logs: this.logs.slice(-limit),
      count: this.logs.length,
    };
  }

  private getRecentErrors(params: Record<string, unknown>): Record<string, unknown> {
    const limit = (params.limit as number) || 20;
    const errors = this.logs.filter((log) => log.level === 'error');
    return {
      errors: errors.slice(-limit),
      count: errors.length,
    };
  }

  private getComponentTree(_params: Record<string, unknown>): Record<string, unknown> {
    // Get registered components
    const registered = Array.from(this.components.values()).map((comp) => ({
      testId: comp.testId,
      type: comp.type,
      props: comp.props,
      hasTapHandler: !!comp.onTap,
      hasTextGetter: !!comp.getText,
      bounds: comp.element ? this.getElementBounds(comp.element) : undefined,
    }));

    // Also scan DOM for data-testid elements
    const domElements = this.scanDOMForTestIds();

    return {
      components: [...registered, ...domElements],
      count: registered.length + domElements.length,
    };
  }

  private scanDOMForTestIds(): Array<Record<string, unknown>> {
    const elements = document.querySelectorAll('[data-testid]');
    return Array.from(elements).map((el) => {
      const htmlEl = el as HTMLElement;
      return {
        testId: htmlEl.dataset.testid,
        type: this.getElementType(htmlEl),
        tagName: htmlEl.tagName.toLowerCase(),
        text: htmlEl.textContent?.slice(0, 100),
        bounds: this.getElementBounds(htmlEl),
        visible: this.isElementVisible(htmlEl),
      };
    });
  }

  private getElementType(el: HTMLElement): string {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');

    if (role) return role;
    if (tag === 'button' || tag === 'a') return 'Button';
    if (tag === 'input') return (el as HTMLInputElement).type || 'Input';
    if (tag === 'img') return 'Image';
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span'].includes(tag)) return 'Text';
    if (tag === 'div' || tag === 'section') return 'View';
    return tag;
  }

  private getElementBounds(el: HTMLElement): Record<string, number> {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }

  private isElementVisible(el: HTMLElement): boolean {
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity) > 0
    );
  }

  private getLayoutTree(_params: Record<string, unknown>): Record<string, unknown> {
    return this.getComponentTree(_params);
  }

  private findElement(params: Record<string, unknown>): Record<string, unknown> {
    const testId = params.testId as string | undefined;
    const type = params.type as string | undefined;
    const text = params.text as string | undefined;

    let elements: Array<Record<string, unknown>> = [];

    if (testId) {
      const el = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
      if (el) {
        elements = [{
          testId,
          type: this.getElementType(el),
          text: el.textContent?.slice(0, 100),
          bounds: this.getElementBounds(el),
        }];
      }
    } else {
      const allElements = this.scanDOMForTestIds();

      if (type) {
        elements = allElements.filter((el) =>
          (el.type as string)?.toLowerCase().includes(type.toLowerCase())
        );
      } else if (text) {
        elements = allElements.filter((el) =>
          (el.text as string)?.toLowerCase().includes(text.toLowerCase())
        );
      } else {
        elements = allElements;
      }
    }

    return { elements, count: elements.length };
  }

  private getElementText(params: Record<string, unknown>): Record<string, unknown> {
    const testId = params.testId as string;

    // Check registered components first
    const comp = this.components.get(testId);
    if (comp?.getText) {
      return { testId, text: comp.getText() };
    }

    // Check DOM
    const el = document.querySelector(`[data-testid="${testId}"]`);
    if (el) {
      return { testId, text: el.textContent };
    }

    return { testId, text: null, error: 'Element not found' };
  }

  private simulateInteraction(params: Record<string, unknown>): Record<string, unknown> {
    const testId = params.testId as string;
    const action = (params.action as string) || (params.type as string) || 'tap';
    const target = params.target as string || testId;

    // Check registered components first
    const comp = this.components.get(target);
    if (comp?.onTap && (action === 'tap' || action === 'click')) {
      comp.onTap();
      return { success: true, testId: target, action };
    }

    // Try DOM element
    const el = document.querySelector(`[data-testid="${target}"]`) as HTMLElement;
    if (el) {
      switch (action) {
        case 'tap':
        case 'click':
          el.click();
          return { success: true, testId: target, action };
          
        case 'input':
        case 'type':
          if (params.value !== undefined) {
            (el as HTMLInputElement).value = String(params.value);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, testId: target, action, value: params.value };
          }
          break;
          
        case 'focus':
          el.focus();
          return { success: true, testId: target, action };
          
        case 'blur':
          el.blur();
          return { success: true, testId: target, action };
          
        case 'scroll':
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return { success: true, testId: target, action };
          
        case 'swipe': {
          const direction = params.direction as string || 'down';
          const distance = (params.distance as number) || 200;
          this.simulateSwipe(el, direction, distance);
          return { success: true, testId: target, action, direction, distance };
        }
          
        case 'long_press':
          // Dispatch touch events for long press
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          setTimeout(() => {
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          }, 500);
          return { success: true, testId: target, action };
          
        case 'double_click':
          el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          return { success: true, testId: target, action };
          
        case 'hover':
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          return { success: true, testId: target, action };
          
        case 'clear':
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, testId: target, action };
          }
          break;
          
        case 'select':
          if (el instanceof HTMLSelectElement && params.value !== undefined) {
            el.value = String(params.value);
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, testId: target, action, value: params.value };
          }
          break;
          
        case 'check':
          if (el instanceof HTMLInputElement && el.type === 'checkbox') {
            el.checked = true;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, testId: target, action, checked: true };
          }
          break;
          
        case 'uncheck':
          if (el instanceof HTMLInputElement && el.type === 'checkbox') {
            el.checked = false;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, testId: target, action, checked: false };
          }
          break;
      }
    }

    return { success: false, testId: target, action, error: 'Element not found or action not supported' };
  }

  private simulateSwipe(el: HTMLElement, direction: string, distance: number): void {
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let endX = centerX;
    let endY = centerY;
    
    switch (direction) {
      case 'up': endY -= distance; break;
      case 'down': endY += distance; break;
      case 'left': endX -= distance; break;
      case 'right': endX += distance; break;
    }
    
    // Simulate touch events
    el.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true,
      touches: [new Touch({ identifier: 0, target: el, clientX: centerX, clientY: centerY })]
    }));
    
    el.dispatchEvent(new TouchEvent('touchmove', {
      bubbles: true,
      touches: [new Touch({ identifier: 0, target: el, clientX: endX, clientY: endY })]
    }));
    
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [] }));
  }

  // ==================== Screenshot ====================

  private async captureScreenshot(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const label = params.label as string || `screenshot_${Date.now()}`;
    
    try {
      // Method 1: Try using html2canvas if available (loaded dynamically)
      if (typeof (window as unknown as { html2canvas?: unknown }).html2canvas === 'function') {
        const canvas = await (window as unknown as { html2canvas: (el: HTMLElement) => Promise<HTMLCanvasElement> }).html2canvas(document.body);
        const dataUrl = canvas.toDataURL('image/png');
        return {
          success: true,
          label,
          format: 'png',
          data: dataUrl,
          width: canvas.width,
          height: canvas.height,
        };
      }
      
      // Method 2: Canvas-based screenshot of visible viewport
      // This is limited but works without external libraries
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not create canvas context');
      }
      
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Draw a simple representation (limited without html2canvas)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Note: Full DOM-to-canvas rendering requires html2canvas library
      // This provides basic info about the viewport
      return {
        success: true,
        label,
        format: 'info',
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        url: window.location.href,
        title: document.title,
        note: 'Full screenshot requires html2canvas library. Install with: npm install html2canvas',
        // For AI to understand the page structure
        visibleElements: this.getVisibleElementsSummary(),
      };
    } catch (error) {
      return {
        success: false,
        label,
        error: error instanceof Error ? error.message : 'Screenshot failed',
      };
    }
  }

  private getVisibleElementsSummary(): Array<Record<string, unknown>> {
    const elements: Array<Record<string, unknown>> = [];
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    document.querySelectorAll('[data-testid]').forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      // Check if element is in viewport
      if (rect.top < viewportHeight && rect.bottom > 0 && 
          rect.left < viewportWidth && rect.right > 0) {
        elements.push({
          testId: (el as HTMLElement).dataset.testid,
          type: this.getElementType(el as HTMLElement),
          text: el.textContent?.slice(0, 50),
          bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
      }
    });
    
    return elements;
  }

  // ==================== Inspect Element by Coordinates ====================

  private inspectElement(params: Record<string, unknown>): Record<string, unknown> {
    const x = params.x as number;
    const y = params.y as number;
    
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    
    if (!el) {
      return { found: false, x, y, error: 'No element at coordinates' };
    }
    
    // Find the nearest element with data-testid (going up the tree)
    let testIdElement: HTMLElement | null = el;
    while (testIdElement && !testIdElement.dataset?.testid) {
      testIdElement = testIdElement.parentElement;
    }
    
    const rect = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);
    
    return {
      found: true,
      x,
      y,
      element: {
        tagName: el.tagName.toLowerCase(),
        type: this.getElementType(el),
        testId: testIdElement?.dataset?.testid || null,
        text: el.textContent?.slice(0, 100),
        bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        styles: {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize,
          display: styles.display,
          visibility: styles.visibility,
        },
        attributes: this.getElementAttributes(el),
      },
    };
  }

  private getElementAttributes(el: HTMLElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of el.attributes) {
      if (!attr.name.startsWith('data-') || attr.name === 'data-testid') {
        attrs[attr.name] = attr.value;
      }
    }
    return attrs;
  }

  private getNavigationState(): NavigationState {
    return {
      ...this.navigationState,
      // Also include browser location
      currentRoute: this.navigationState.currentRoute || window.location.pathname,
    };
  }

  private queryStorage(params: Record<string, unknown>): Record<string, unknown> {
    const key = params.key as string | undefined;
    const type = (params.type as string) || 'localStorage';

    const storage = type === 'sessionStorage' ? sessionStorage : localStorage;

    if (key) {
      const value = storage.getItem(key);
      return { key, value: value ? JSON.parse(value) : null, exists: value !== null };
    }

    // Return all keys
    const result: Record<string, unknown> = {};
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k) {
        try {
          result[k] = JSON.parse(storage.getItem(k) || 'null');
        } catch {
          result[k] = storage.getItem(k);
        }
      }
    }
    return { storage: result, count: storage.length };
  }

  private mockNetworkRequest(params: Record<string, unknown>): Record<string, unknown> {
    const id = `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const mock: NetworkMock = {
      id,
      urlPattern: params.urlPattern as string,
      statusCode: (params.statusCode as number) || 200,
      body: params.body,
      headers: params.headers as Record<string, string>,
      delay: params.delay as number,
    };

    this.networkMocks.set(id, mock);
    return { id, urlPattern: mock.urlPattern };
  }

  private clearNetworkMocks(): Record<string, unknown> {
    const count = this.networkMocks.size;
    this.networkMocks.clear();
    return { success: true, clearedCount: count };
  }

  private getRegisteredActions(): { actions: string[] } {
    return { actions: Array.from(this.actionHandlers.keys()) };
  }

  private async executeAction(
    name: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const handler = this.actionHandlers.get(name);
    if (!handler) {
      throw new Error(`Action not registered: ${name}`);
    }

    const result = await handler(params);
    return { success: true, action: name, result };
  }

  private getTraces(params: Record<string, unknown>): Record<string, unknown> {
    const limit = (params.limit as number) || 100;
    const inProgress = params.inProgress as boolean;
    const minDuration = params.minDuration as number | undefined;

    let traces: TraceEntry[];

    if (inProgress) {
      traces = Array.from(this.activeTraces.values()).filter(
        (t) => !t.id.startsWith('name:')
      );
    } else {
      traces = this.traceHistory.slice(-limit);
      if (minDuration !== undefined) {
        traces = traces.filter((t) => (t.duration || 0) >= minDuration);
      }
    }

    return { traces, count: traces.length };
  }

  private clearTraces(): void {
    this.traceHistory = [];
    this.activeTraces.clear();
  }

  private injectTrace(params: Record<string, unknown>): Record<string, unknown> {
    const pattern = params.pattern as string;
    if (!pattern) {
      throw new Error('pattern is required');
    }

    this.traceIdCounter++;
    const id = `inject_${this.traceIdCounter}_${Date.now()}`;

    this.injectedTraces.set(id, {
      pattern,
      logArgs: (params.logArgs as boolean) ?? true,
      logReturn: (params.logReturn as boolean) ?? true,
      createdAt: Date.now(),
    });

    return { success: true, id, pattern };
  }

  private removeInjectedTrace(params: Record<string, unknown>): Record<string, unknown> {
    const id = params.id as string;
    const removed = this.injectedTraces.delete(id);
    return { success: removed };
  }

  private listInjectedTraces(): Record<string, unknown> {
    const traces = Array.from(this.injectedTraces.entries()).map(([id, trace]) => ({
      id,
      ...trace,
    }));
    return { traces, count: traces.length };
  }

  private interceptConsole(): void {
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };

    const captureLog = (level: string, args: unknown[]) => {
      this.logs.push({
        level,
        message: args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
        timestamp: new Date().toISOString(),
      });

      // Keep logs limited
      if (this.logs.length > 1000) {
        this.logs.shift();
      }
    };

    console.log = (...args) => {
      captureLog('info', args);
      originalConsole.log.apply(console, args);
    };
    console.warn = (...args) => {
      captureLog('warn', args);
      originalConsole.warn.apply(console, args);
    };
    console.error = (...args) => {
      captureLog('error', args);
      originalConsole.error.apply(console, args);
    };
    console.info = (...args) => {
      captureLog('info', args);
      originalConsole.info.apply(console, args);
    };
    console.debug = (...args) => {
      captureLog('debug', args);
      originalConsole.debug.apply(console, args);
    };
  }

  private interceptFetch(): void {
    this.originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';
      const startTime = Date.now();

      // Check for mocks
      for (const mock of self.networkMocks.values()) {
        const pattern = new RegExp(mock.urlPattern);
        if (pattern.test(url)) {
          if (mock.delay) {
            await new Promise((resolve) => setTimeout(resolve, mock.delay));
          }
          return new Response(JSON.stringify(mock.body), {
            status: mock.statusCode,
            headers: mock.headers,
          });
        }
      }

      try {
        const response = await self.originalFetch!.call(window, input, init);
        const duration = Date.now() - startTime;

        self.networkRequests.push({
          url,
          method,
          status: response.status,
          duration,
          timestamp: new Date().toISOString(),
        });

        // Keep requests limited
        if (self.networkRequests.length > 100) {
          self.networkRequests.shift();
        }

        return response;
      } catch (error) {
        self.networkRequests.push({
          url,
          method,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }
    };
  }
}

// Export singleton instance
export const MCPBridge = new MCPBridgeClass();
