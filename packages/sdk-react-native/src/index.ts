/**
 * Mobile Dev MCP - React Native SDK
 * 
 * Enables AI-assisted development by connecting your React Native app to Cursor IDE.
 * 
 * @example
 * ```typescript
 * import { MCPBridge } from '@mobile-dev-mcp/react-native';
 * 
 * if (__DEV__) {
 *   MCPBridge.initialize({
 *     serverUrl: 'ws://localhost:8765'
 *   });
 *   
 *   // Expose your Redux store
 *   MCPBridge.exposeState('store', () => store.getState());
 * }
 * ```
 */

export { MCPBridge } from './MCPBridge';
export type { MCPConfig, StateGetter } from './types';

// Auto-init module for minimal setup
export { autoInit } from './auto-init';

// Adapters (for advanced usage)
export { StateAdapter } from './adapters/StateAdapter';
export { NetworkAdapter } from './adapters/NetworkAdapter';
export { LogAdapter } from './adapters/LogAdapter';
