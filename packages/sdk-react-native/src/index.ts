/**
 * @mobile-dev-mcp/react-native
 * 
 * React Native SDK for Mobile Dev MCP - AI-assisted mobile development
 * 
 * @example
 * ```typescript
 * import { MCPBridge } from '@mobile-dev-mcp/react-native';
 * 
 * // Initialize in your app entry point
 * MCPBridge.initialize();
 * 
 * // Expose state for AI inspection
 * MCPBridge.exposeState('user', () => currentUser);
 * MCPBridge.exposeState('cart', () => cartItems);
 * 
 * // Register actions for AI control
 * MCPBridge.registerAction('addToCart', (params) => {
 *   addToCart(params.productId);
 *   return { success: true };
 * });
 * ```
 */

export { MCPBridge } from './MCPBridge';
export type {
  MCPConfig,
  MCPState,
  MCPCommand,
  StateGetter,
  ActionHandler,
  ActivityEntry,
  RegisteredComponent,
  ComponentConfig,
} from './types';
