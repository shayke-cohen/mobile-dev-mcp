/**
 * React Native SDK Tracing Tests
 * 
 * Tests for the tracing functionality in MCPBridge
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the bridge for testing (since we can't import the full RN module)
class MockMCPBridge {
  private traces: Map<string, any> = new Map();
  private traceHistory: any[] = [];
  private traceIdCounter = 0;
  private injectedTraces: Map<string, any> = new Map();

  trace(name: string, info: any = {}): string {
    const id = `trace_${++this.traceIdCounter}`;
    const entry = {
      id,
      name,
      info,
      timestamp: Date.now(),
      completed: false,
    };
    this.traces.set(name, entry);
    return id;
  }

  traceReturn(name: string, returnValue?: any, error?: string): void {
    const entry = this.traces.get(name);
    if (entry) {
      entry.completed = true;
      entry.duration = Date.now() - entry.timestamp;
      entry.returnValue = returnValue;
      entry.error = error;
      this.traceHistory.push({ ...entry });
      this.traces.delete(name);
    }
  }

  traceSync<T>(name: string, fn: () => T): T {
    this.trace(name);
    try {
      const result = fn();
      this.traceReturn(name, result);
      return result;
    } catch (error: any) {
      this.traceReturn(name, undefined, error.message);
      throw error;
    }
  }

  async traceAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.trace(name);
    try {
      const result = await fn();
      this.traceReturn(name, result);
      return result;
    } catch (error: any) {
      this.traceReturn(name, undefined, error.message);
      throw error;
    }
  }

  getTraces(filter: any = {}): any[] {
    let traces = [...this.traceHistory];
    
    if (filter.name) {
      traces = traces.filter(t => t.name.includes(filter.name));
    }
    if (filter.minDuration) {
      traces = traces.filter(t => t.duration >= filter.minDuration);
    }
    if (filter.limit) {
      traces = traces.slice(-filter.limit);
    }
    
    return traces;
  }

  clearTraces(): void {
    this.traces.clear();
    this.traceHistory = [];
  }

  injectTrace(pattern: string, options: any = {}): string {
    const id = `inject_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
    
    this.injectedTraces.set(id, {
      pattern: new RegExp(`^${regexPattern}$`),
      logArgs: options.logArgs !== false,
      logReturn: options.logReturn !== false,
      active: true,
    });
    
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

  listInjectedTraces(): any[] {
    return Array.from(this.injectedTraces.entries()).map(([id, config]) => ({
      id,
      pattern: config.pattern.source,
      active: config.active,
    }));
  }
}

describe('MCPBridge Tracing', () => {
  let bridge: MockMCPBridge;

  beforeEach(() => {
    bridge = new MockMCPBridge();
  });

  describe('Basic Tracing', () => {
    it('should create a trace entry', () => {
      const id = bridge.trace('TestFunction', { args: { x: 1 } });
      expect(id).toBeDefined();
      expect(id).toMatch(/^trace_/);
    });

    it('should complete trace on traceReturn', () => {
      bridge.trace('TestFunction');
      bridge.traceReturn('TestFunction', 42);
      
      const traces = bridge.getTraces();
      expect(traces).toHaveLength(1);
      expect(traces[0].name).toBe('TestFunction');
      expect(traces[0].completed).toBe(true);
      expect(traces[0].returnValue).toBe(42);
    });

    it('should capture error in trace', () => {
      bridge.trace('FailingFunction');
      bridge.traceReturn('FailingFunction', undefined, 'Something went wrong');
      
      const traces = bridge.getTraces();
      expect(traces[0].error).toBe('Something went wrong');
    });

    it('should track duration', () => {
      bridge.trace('SlowFunction');
      // Simulate some time passing
      const start = Date.now();
      while (Date.now() - start < 10) {
        // busy wait
      }
      bridge.traceReturn('SlowFunction');
      
      const traces = bridge.getTraces();
      expect(traces[0].duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('traceSync', () => {
    it('should wrap sync function and return result', () => {
      const result = bridge.traceSync('addNumbers', () => 2 + 2);
      
      expect(result).toBe(4);
      const traces = bridge.getTraces();
      expect(traces).toHaveLength(1);
      expect(traces[0].name).toBe('addNumbers');
      expect(traces[0].returnValue).toBe(4);
    });

    it('should capture errors from sync function', () => {
      expect(() => {
        bridge.traceSync('failingFunction', () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');
      
      const traces = bridge.getTraces();
      expect(traces[0].error).toBe('Test error');
    });
  });

  describe('traceAsync', () => {
    it('should wrap async function and return result', async () => {
      const result = await bridge.traceAsync('fetchData', async () => {
        return { data: 'test' };
      });
      
      expect(result).toEqual({ data: 'test' });
      const traces = bridge.getTraces();
      expect(traces).toHaveLength(1);
      expect(traces[0].name).toBe('fetchData');
    });

    it('should capture errors from async function', async () => {
      await expect(
        bridge.traceAsync('failingAsync', async () => {
          throw new Error('Async error');
        })
      ).rejects.toThrow('Async error');
      
      const traces = bridge.getTraces();
      expect(traces[0].error).toBe('Async error');
    });
  });

  describe('Trace Filtering', () => {
    beforeEach(() => {
      bridge.traceSync('UserService.fetchUser', () => ({ id: 1 }));
      bridge.traceSync('UserService.updateUser', () => true);
      bridge.traceSync('CartService.addItem', () => ({ count: 1 }));
    });

    it('should filter by name', () => {
      const traces = bridge.getTraces({ name: 'UserService' });
      expect(traces).toHaveLength(2);
    });

    it('should limit results', () => {
      const traces = bridge.getTraces({ limit: 2 });
      expect(traces).toHaveLength(2);
    });

    it('should clear traces', () => {
      bridge.clearTraces();
      const traces = bridge.getTraces();
      expect(traces).toHaveLength(0);
    });
  });

  describe('Dynamic Instrumentation', () => {
    it('should inject trace with pattern', () => {
      const id = bridge.injectTrace('CartService.*');
      expect(id).toBeDefined();
      expect(id).toMatch(/^inject_/);
    });

    it('should list injected traces', () => {
      bridge.injectTrace('CartService.*');
      bridge.injectTrace('UserService.fetch*');
      
      const traces = bridge.listInjectedTraces();
      expect(traces).toHaveLength(2);
    });

    it('should remove injected trace by id', () => {
      const id = bridge.injectTrace('CartService.*');
      expect(bridge.listInjectedTraces()).toHaveLength(1);
      
      const removed = bridge.removeTrace(id);
      expect(removed).toBe(true);
      expect(bridge.listInjectedTraces()).toHaveLength(0);
    });

    it('should clear all injected traces', () => {
      bridge.injectTrace('CartService.*');
      bridge.injectTrace('UserService.*');
      bridge.injectTrace('API.*');
      
      const cleared = bridge.clearInjectedTraces();
      expect(cleared).toBe(3);
      expect(bridge.listInjectedTraces()).toHaveLength(0);
    });

    it('should convert wildcard pattern to regex', () => {
      bridge.injectTrace('Cart*.add*');
      
      const traces = bridge.listInjectedTraces();
      expect(traces[0].pattern).toContain('Cart.*');
      expect(traces[0].pattern).toContain('add.*');
    });
  });
});
