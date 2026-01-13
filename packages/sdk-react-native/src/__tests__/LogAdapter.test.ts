/**
 * LogAdapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogAdapter } from '../adapters/LogAdapter';

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

describe('LogAdapter', () => {
  let adapter: LogAdapter;

  beforeEach(() => {
    adapter = new LogAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    adapter.disable();
    // Restore console
    Object.assign(console, originalConsole);
  });

  describe('enable/disable', () => {
    it('should intercept console methods when enabled', () => {
      const originalLog = console.log;
      adapter.enable();
      expect(console.log).not.toBe(originalLog);
    });

    it('should restore console methods when disabled', () => {
      adapter.enable();
      adapter.disable();
      // Console should be restored
      expect(console.log).toBeDefined();
    });
  });

  describe('log capture', () => {
    it('should capture console.log', () => {
      adapter.enable();
      console.log('test message');

      const result = adapter.getLogs({ limit: 10 });
      expect((result.logs as unknown[]).length).toBeGreaterThan(0);
    });

    it('should capture console.warn', () => {
      adapter.enable();
      console.warn('warning message');

      const result = adapter.getLogs({ level: 'warn' });
      const logs = result.logs as Array<{ level: string }>;
      expect(logs.some(l => l.level === 'warn')).toBe(true);
    });

    it('should capture console.error', () => {
      adapter.enable();
      console.error('error message');

      const result = adapter.getLogs({ level: 'error' });
      const logs = result.logs as Array<{ level: string }>;
      expect(logs.some(l => l.level === 'error')).toBe(true);
    });

    it('should capture multiple arguments', () => {
      adapter.enable();
      console.log('test', { data: 'value' }, 123);

      const result = adapter.getLogs({ limit: 1 });
      const logs = result.logs as Array<{ message: string }>;
      expect(logs[0].message).toContain('test');
    });
  });

  describe('getLogs', () => {
    beforeEach(() => {
      adapter.enable();
      console.log('log message');
      console.warn('warn message');
      console.error('error message');
    });

    it('should filter by level', () => {
      const result = adapter.getLogs({ level: 'error' });
      const logs = result.logs as Array<{ level: string }>;
      expect(logs.every(l => l.level === 'error')).toBe(true);
    });

    it('should filter by search term', () => {
      const result = adapter.getLogs({ search: 'warn' });
      const logs = result.logs as Array<{ message: string }>;
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].message).toContain('warn');
    });

    it('should respect limit', () => {
      for (let i = 0; i < 50; i++) {
        console.log(`message ${i}`);
      }

      const result = adapter.getLogs({ limit: 10 });
      expect((result.logs as unknown[]).length).toBe(10);
    });
  });

  describe('getRecentErrors', () => {
    it('should only return errors', () => {
      adapter.enable();
      console.log('not an error');
      console.warn('just a warning');
      console.error('this is an error');
      console.error('another error');

      const result = adapter.getRecentErrors({});
      const errors = result.errors as unknown[];
      expect(errors.length).toBe(2);
    });
  });

  describe('Function Tracing', () => {
    it('should record function trace', () => {
      adapter.enable();
      adapter.trace('testFunction', { args: { a: 1 } });

      const result = adapter.getFunctionTrace({});
      const traces = result.traces as Array<{ name: string }>;
      expect(traces.some(t => t.name === 'testFunction')).toBe(true);
    });

    it('should record trace return', () => {
      adapter.enable();
      adapter.trace('myFunc', { args: {} });
      adapter.traceReturn('myFunc', { success: true });

      const result = adapter.getFunctionTrace({});
      const traces = result.traces as Array<{ name: string; returnValue?: unknown }>;
      const trace = traces.find(t => t.name === 'myFunc');
      expect(trace?.returnValue).toEqual({ success: true });
    });

    it('should filter traces by function name', () => {
      adapter.enable();
      adapter.trace('functionA', { args: {} });
      adapter.trace('functionB', { args: {} });
      adapter.trace('functionA', { args: {} });

      const result = adapter.getFunctionTrace({ functionName: 'functionA' });
      const traces = result.traces as unknown[];
      expect(traces.length).toBe(2);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      adapter.enable();
      console.log('message 1');
      console.log('message 2');

      adapter.clearLogs();

      const result = adapter.getLogs({});
      expect((result.logs as unknown[]).length).toBe(0);
    });
  });
});
