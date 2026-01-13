/**
 * StateAdapter - Handles state inspection and exposure
 */

import type { StateGetter } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class StateAdapter {
  private stateGetters: Map<string, StateGetter> = new Map();
  private store: { getState: () => unknown } | null = null;
  private navigationRef: { current: unknown } | null = null;
  private featureFlags: Record<string, boolean> = {};

  /**
   * Register a state getter
   */
  expose(key: string, getter: StateGetter): void {
    this.stateGetters.set(key, getter);
  }

  /**
   * Connect a Redux/Zustand store
   */
  connectStore(store: { getState: () => unknown }): void {
    this.store = store;
    this.expose('store', () => store.getState());
  }

  /**
   * Set navigation ref for state inspection
   */
  setNavigationRef(ref: { current: unknown }): void {
    this.navigationRef = ref;
  }

  /**
   * Register feature flags
   */
  registerFeatureFlags(flags: Record<string, boolean>): void {
    this.featureFlags = { ...this.featureFlags, ...flags };
  }

  /**
   * Get state by path
   */
  getState(params: { path?: string; deep?: boolean }): Record<string, unknown> {
    const { path, deep = true } = params;

    if (path) {
      // Get specific path
      const parts = path.split('.');
      const rootKey = parts[0];
      const getter = this.stateGetters.get(rootKey);

      if (!getter) {
        throw new Error(`State '${rootKey}' not exposed. Did you call MCPBridge.exposeState('${rootKey}', ...)?`);
      }

      let value = getter();

      // Navigate to nested path
      for (let i = 1; i < parts.length && value != null; i++) {
        value = (value as Record<string, unknown>)[parts[i]];
      }

      return {
        path,
        value: deep ? value : this.shallowCopy(value),
        timestamp: new Date().toISOString(),
      };
    }

    // Get all exposed state
    const allState: Record<string, unknown> = {};
    for (const [key, getter] of this.stateGetters) {
      try {
        allState[key] = deep ? getter() : this.shallowCopy(getter());
      } catch (error) {
        allState[key] = `<Error: ${error instanceof Error ? error.message : 'Unknown'}>`;
      }
    }

    return {
      state: allState,
      exposedKeys: Array.from(this.stateGetters.keys()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Query AsyncStorage
   */
  async queryStorage(params: { key?: string; pattern?: string }): Promise<Record<string, unknown>> {
    const { key, pattern } = params;

    try {
      if (key) {
        const value = await AsyncStorage.getItem(key);
        return {
          [key]: value ? JSON.parse(value) : null,
        };
      }

      // Get all keys
      const allKeys = await AsyncStorage.getAllKeys();
      let keys = allKeys;

      // Filter by pattern if provided
      if (pattern) {
        const regex = new RegExp(pattern);
        keys = allKeys.filter(k => regex.test(k));
      }

      // Get all values
      const pairs = await AsyncStorage.multiGet(keys);
      const result: Record<string, unknown> = {};

      for (const [k, v] of pairs) {
        try {
          result[k] = v ? JSON.parse(v) : null;
        } catch {
          result[k] = v;
        }
      }

      return {
        data: result,
        count: keys.length,
      };

    } catch (error) {
      throw new Error(`Failed to query storage: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Get navigation state
   */
  getNavigationState(): Record<string, unknown> {
    if (!this.navigationRef?.current) {
      return {
        error: 'Navigation ref not set. Call MCPBridge.setNavigationRef(navigationRef)',
      };
    }

    const nav = this.navigationRef.current as {
      getCurrentRoute?: () => { name: string; params?: unknown };
      getState?: () => { routes: { name: string; params?: unknown }[] };
    };

    try {
      const currentRoute = nav.getCurrentRoute?.();
      const state = nav.getState?.();

      return {
        currentRoute: currentRoute?.name,
        params: currentRoute?.params,
        stack: state?.routes?.map(r => r.name) || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: `Failed to get navigation state: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }
  }

  /**
   * Get feature flags
   */
  getFeatureFlags(): Record<string, unknown> {
    return {
      flags: this.featureFlags,
      count: Object.keys(this.featureFlags).length,
    };
  }

  /**
   * Toggle feature flag
   */
  toggleFeatureFlag(params: { flagName: string; enabled: boolean }): Record<string, unknown> {
    const { flagName, enabled } = params;

    if (!(flagName in this.featureFlags)) {
      throw new Error(`Feature flag '${flagName}' not registered`);
    }

    const previousValue = this.featureFlags[flagName];
    this.featureFlags[flagName] = enabled;

    return {
      flagName,
      enabled,
      previousValue,
      success: true,
    };
  }

  /**
   * Create shallow copy for large objects
   */
  private shallowCopy(value: unknown): unknown {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.slice(0, 10).map(() => '<array item>');
    }

    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as object)) {
      copy[k] = typeof v === 'object' ? '<object>' : v;
    }
    return copy;
  }
}
