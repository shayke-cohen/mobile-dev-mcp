/**
 * Auto-init module for minimal setup
 * 
 * Just import this module and everything is set up automatically:
 * 
 * @example
 * ```typescript
 * import '@mobile-dev-mcp/react-native/auto-init';
 * ```
 */

import { MCPBridge } from './MCPBridge';

declare const __DEV__: boolean;

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // Initialize with default settings
  MCPBridge.initialize({
    serverUrl: 'ws://localhost:8765',
    autoConnect: true,
    debug: false,
  });

  // Enable all auto-instrumentation
  MCPBridge.enableNetworkInterception();
  MCPBridge.enableLogCapture();

  console.log('[MCP SDK] Auto-initialized. Connect your app to Cursor for AI-assisted development.');
}

export function autoInit() {
  // Function exists for explicit import if needed
  // The side effect above handles initialization
}
