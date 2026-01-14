/**
 * MCPBridge Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPBridge } from '../MCPBridge';

describe('MCPBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('State Management', () => {
    it('exposeState registers a state getter', () => {
      const getter = () => ({ items: [] });
      MCPBridge.exposeState('cart', getter);
      
      // The state should be accessible
      MCPBridge.removeState('cart');
    });

    it('removeState removes a state getter', () => {
      MCPBridge.exposeState('test', () => 'value');
      MCPBridge.removeState('test');
      // Should not throw
    });
  });

  describe('Action Registration', () => {
    it('registerAction registers an action handler', () => {
      const handler = vi.fn().mockReturnValue({ success: true });
      MCPBridge.registerAction('testAction', handler);
      MCPBridge.removeAction('testAction');
    });

    it('removeAction removes an action handler', () => {
      MCPBridge.registerAction('testAction', () => ({}));
      MCPBridge.removeAction('testAction');
      // Should not throw
    });
  });

  describe('Component Registration', () => {
    it('registerComponent registers a component', () => {
      MCPBridge.registerComponent('test-btn', 'Button', {
        getText: () => 'Click me',
        onTap: () => {},
      });
      
      MCPBridge.unregisterComponent('test-btn');
    });

    it('unregisterComponent removes a component', () => {
      MCPBridge.registerComponent('test-btn', 'Button');
      MCPBridge.unregisterComponent('test-btn');
      // Should not throw
    });
  });

  describe('Navigation', () => {
    it('setNavigationState updates navigation', () => {
      MCPBridge.setNavigationState('/products', { category: 'electronics' });
      // Should not throw
    });
  });

  describe('Feature Flags', () => {
    it('registerFeatureFlags registers flags', () => {
      MCPBridge.registerFeatureFlags({
        darkMode: true,
        newFeature: false,
      });
      
      expect(MCPBridge.getFeatureFlag('darkMode')).toBe(true);
      expect(MCPBridge.getFeatureFlag('newFeature')).toBe(false);
    });

    it('getFeatureFlag returns default false for unknown flags', () => {
      expect(MCPBridge.getFeatureFlag('unknownFlag')).toBe(false);
    });
  });

  describe('Tracing', () => {
    it('trace creates a trace entry', () => {
      const id = MCPBridge.trace('testFunction', { args: { x: 1 } });
      expect(id).toMatch(/^trace_\d+_\d+$/);
    });

    it('traceReturn completes a trace', () => {
      MCPBridge.trace('testFunction');
      MCPBridge.traceReturn('testFunction', { result: 'success' });
      // Should not throw
    });

    it('traceSync traces synchronous functions', () => {
      const result = MCPBridge.traceSync('syncFunc', () => {
        return 42;
      });
      expect(result).toBe(42);
    });

    it('traceAsync traces asynchronous functions', async () => {
      const result = await MCPBridge.traceAsync('asyncFunc', async () => {
        return Promise.resolve('async result');
      });
      expect(result).toBe('async result');
    });

    it('traceAsync captures errors', async () => {
      await expect(
        MCPBridge.traceAsync('failingFunc', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });

  describe('Event Handling', () => {
    it('on subscribes to events', () => {
      const callback = vi.fn();
      const unsubscribe = MCPBridge.on('testEvent', callback);
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('Connection', () => {
    it('getIsConnected returns connection status', () => {
      const status = MCPBridge.getIsConnected();
      expect(typeof status).toBe('boolean');
    });
  });
});
