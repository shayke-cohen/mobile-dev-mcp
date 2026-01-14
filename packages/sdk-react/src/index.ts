/**
 * @mobile-dev-mcp/react
 * 
 * React SDK for Mobile Dev MCP - AI-assisted web development with Cursor IDE.
 */

// Core
export { MCPBridge } from './MCPBridge';
export type {
  TraceInfo,
  TraceEntry,
  RegisteredComponent,
  NavigationState,
  NetworkMock,
  MCPBridgeOptions,
} from './MCPBridge';

// Provider
export { MCPProvider, useMCPContext, MCPStatusBadge } from './providers';
export type { MCPProviderProps } from './providers';

// Hooks
export {
  // State
  useMCPState,
  useMCPStates,
  // Actions
  useMCPAction,
  useMCPActions,
  useMCPTrigger,
  // Components
  useMCPComponent,
  useMCPButton,
  useMCPText,
  useMCPClickable,
  // Navigation
  useMCPNavigation,
  useMCPAutoNavigation,
  // Tracing
  useMCPTrace,
  useMCPTraceRender,
  withTrace,
  // Connection
  useMCPConnection,
} from './hooks';
