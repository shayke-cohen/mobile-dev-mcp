/**
 * StateAdapter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateAdapter } from '../adapters/StateAdapter';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    getAllKeys: vi.fn(),
    multiGet: vi.fn(),
  },
}));

describe('StateAdapter', () => {
  let adapter: StateAdapter;

  beforeEach(() => {
    adapter = new StateAdapter();
    vi.clearAllMocks();
  });

  describe('expose', () => {
    it('should register a state getter', () => {
      const getter = () => ({ test: 'value' });
      adapter.expose('myState', getter);

      const result = adapter.getState({ path: 'myState' });
      expect(result.value).toEqual({ test: 'value' });
    });

    it('should allow overwriting existing state', () => {
      adapter.expose('key', () => 'first');
      adapter.expose('key', () => 'second');

      const result = adapter.getState({ path: 'key' });
      expect(result.value).toBe('second');
    });
  });

  describe('connectStore', () => {
    it('should connect a Redux-like store', () => {
      const mockStore = {
        getState: () => ({
          user: { name: 'John' },
          cart: { items: [] },
        }),
      };

      adapter.connectStore(mockStore);

      const result = adapter.getState({ path: 'store' });
      expect(result.value).toEqual({
        user: { name: 'John' },
        cart: { items: [] },
      });
    });
  });

  describe('getState', () => {
    beforeEach(() => {
      adapter.expose('app', () => ({
        user: {
          name: 'John',
          email: 'john@example.com',
        },
        settings: {
          theme: 'dark',
        },
      }));
    });

    it('should get all exposed state when no path provided', () => {
      const result = adapter.getState({});
      expect(result.state).toBeDefined();
      expect(result.exposedKeys).toContain('app');
    });

    it('should get nested state by path', () => {
      const result = adapter.getState({ path: 'app.user.name' });
      expect(result.value).toBe('John');
    });

    it('should return error for non-exposed state', () => {
      expect(() => adapter.getState({ path: 'nonexistent' })).toThrow(
        "State 'nonexistent' not exposed"
      );
    });

    it('should handle deep flag', () => {
      const result = adapter.getState({ path: 'app', deep: true });
      expect(result.value).toHaveProperty('user');
      expect(result.value).toHaveProperty('settings');
    });
  });

  describe('Feature Flags', () => {
    beforeEach(() => {
      adapter.registerFeatureFlags({
        newFeature: true,
        betaMode: false,
        experimentalUI: true,
      });
    });

    it('should get all feature flags', () => {
      const result = adapter.getFeatureFlags();
      expect(result.flags).toEqual({
        newFeature: true,
        betaMode: false,
        experimentalUI: true,
      });
      expect(result.count).toBe(3);
    });

    it('should toggle feature flag', () => {
      const result = adapter.toggleFeatureFlag({
        flagName: 'betaMode',
        enabled: true,
      });

      expect(result.success).toBe(true);
      expect(result.previousValue).toBe(false);
      expect(result.enabled).toBe(true);

      // Verify it was changed
      const flags = adapter.getFeatureFlags();
      expect(flags.flags.betaMode).toBe(true);
    });

    it('should throw error for unregistered flag', () => {
      expect(() =>
        adapter.toggleFeatureFlag({ flagName: 'unknownFlag', enabled: true })
      ).toThrow("Feature flag 'unknownFlag' not registered");
    });
  });

  describe('Navigation State', () => {
    it('should return error when nav ref not set', () => {
      const result = adapter.getNavigationState();
      expect(result.error).toContain('Navigation ref not set');
    });

    it('should get navigation state when ref is set', () => {
      const mockNavRef = {
        current: {
          getCurrentRoute: () => ({ name: 'Home', params: { id: 1 } }),
          getState: () => ({
            routes: [
              { name: 'Home', params: { id: 1 } },
              { name: 'Details' },
            ],
          }),
        },
      };

      adapter.setNavigationRef(mockNavRef);
      const result = adapter.getNavigationState();

      expect(result.currentRoute).toBe('Home');
      expect(result.params).toEqual({ id: 1 });
      expect(result.stack).toEqual(['Home', 'Details']);
    });
  });
});
