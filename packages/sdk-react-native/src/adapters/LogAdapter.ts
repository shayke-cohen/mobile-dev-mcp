/**
 * LogAdapter - Captures console logs and function traces
 */

import type { LogEntry, ErrorEntry } from '../types';

interface TraceEntry {
  functionName: string;
  type: 'enter' | 'exit' | 'error';
  data?: unknown;
  timestamp: string;
}

export class LogAdapter {
  private logs: LogEntry[] = [];
  private errors: ErrorEntry[] = [];
  private traces: TraceEntry[] = [];
  private maxLogs = 500;
  private maxErrors = 50;
  private maxTraces = 1000;
  private enabled = false;
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
  } | null = null;

  /**
   * Enable log capturing
   */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.interceptConsole();
    this.setupErrorHandler();
  }

  /**
   * Disable log capturing
   */
  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.restoreConsole();
  }

  /**
   * Get captured logs
   */
  getLogs(params: { level?: string; filter?: string; limit?: number; since?: string }): Record<string, unknown> {
    const { level, filter, limit = 100, since } = params;

    let filtered = [...this.logs];

    if (level) {
      const levels = ['debug', 'info', 'warn', 'error'];
      const minLevel = levels.indexOf(level);
      filtered = filtered.filter(l => levels.indexOf(l.level) >= minLevel);
    }

    if (filter) {
      const pattern = new RegExp(filter, 'i');
      filtered = filtered.filter(l => pattern.test(l.message));
    }

    if (since) {
      const sinceDate = new Date(since);
      filtered = filtered.filter(l => new Date(l.timestamp) >= sinceDate);
    }

    return {
      logs: filtered.slice(-limit),
      total: this.logs.length,
      filtered: filtered.length,
    };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(params: { limit?: number; severity?: string }): Record<string, unknown> {
    const { limit = 10 } = params;

    return {
      errors: this.errors.slice(-limit),
      total: this.errors.length,
    };
  }

  /**
   * Get function traces
   */
  getFunctionTrace(params: { functionName?: string; limit?: number; includeArgs?: boolean; includeReturns?: boolean }): Record<string, unknown> {
    const { functionName, limit = 100 } = params;

    let filtered = [...this.traces];

    if (functionName) {
      const pattern = functionName.includes('*')
        ? new RegExp(functionName.replace(/\*/g, '.*'))
        : new RegExp(`^${functionName}$`);
      filtered = filtered.filter(t => pattern.test(t.functionName));
    }

    return {
      traces: filtered.slice(-limit),
      total: this.traces.length,
      filtered: filtered.length,
    };
  }

  /**
   * Add a trace entry (called by instrumented code)
   */
  addTrace(functionName: string, type: 'enter' | 'exit' | 'error', data?: unknown): void {
    const entry: TraceEntry = {
      functionName,
      type,
      data: this.safeSerialize(data),
      timestamp: new Date().toISOString(),
    };

    this.traces.push(entry);

    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(-this.maxTraces);
    }
  }

  /**
   * Intercept console methods
   */
  private interceptConsole(): void {
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    const self = this;

    console.log = function(...args: unknown[]) {
      self.addLog('info', args);
      self.originalConsole!.log.apply(console, args);
    };

    console.info = function(...args: unknown[]) {
      self.addLog('info', args);
      self.originalConsole!.info.apply(console, args);
    };

    console.warn = function(...args: unknown[]) {
      self.addLog('warn', args);
      self.originalConsole!.warn.apply(console, args);
    };

    console.error = function(...args: unknown[]) {
      self.addLog('error', args);
      self.originalConsole!.error.apply(console, args);
    };
  }

  private restoreConsole(): void {
    if (this.originalConsole) {
      console.log = this.originalConsole.log;
      console.info = this.originalConsole.info;
      console.warn = this.originalConsole.warn;
      console.error = this.originalConsole.error;
      this.originalConsole = null;
    }
  }

  private setupErrorHandler(): void {
    const self = this;

    // Handle unhandled JS errors
    if (typeof ErrorUtils !== 'undefined') {
      const originalHandler = ErrorUtils.getGlobalHandler();

      ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        self.addError(error);
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }

    // Handle promise rejections
    const originalRejectionHandler = global.onunhandledrejection;
    global.onunhandledrejection = (event: PromiseRejectionEvent) => {
      self.addError(event.reason);
      if (originalRejectionHandler) {
        originalRejectionHandler.call(global, event);
      }
    };
  }

  private addLog(level: LogEntry['level'], args: unknown[]): void {
    const entry: LogEntry = {
      level,
      message: args.map(a => this.formatArg(a)).join(' '),
      timestamp: new Date().toISOString(),
      args: args.map(a => this.safeSerialize(a)),
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  private addError(error: Error | unknown): void {
    const entry: ErrorEntry = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      context: {},
    };

    this.errors.push(entry);

    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
  }

  private formatArg(arg: unknown): string {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }

  private safeSerialize(value: unknown): unknown {
    try {
      JSON.stringify(value);
      return value;
    } catch {
      return '<not serializable>';
    }
  }
}

// Declare ErrorUtils for React Native
declare const ErrorUtils: {
  getGlobalHandler(): (error: Error, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: Error, isFatal?: boolean) => void): void;
};
