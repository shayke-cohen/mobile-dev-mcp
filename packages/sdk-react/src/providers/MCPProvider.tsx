/**
 * MCPProvider Component
 * 
 * Initializes the MCP SDK and provides context to child components.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { MCPBridge, MCPBridgeOptions } from '../MCPBridge';

interface MCPContextValue {
  isConnected: boolean;
  isInitialized: boolean;
}

const MCPContext = createContext<MCPContextValue>({
  isConnected: false,
  isInitialized: false,
});

export interface MCPProviderProps {
  /** Child components */
  children: ReactNode;
  /** Server URL (defaults to ws://localhost:8765) */
  serverUrl?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Callback when connected */
  onConnected?: () => void;
  /** Callback when disconnected */
  onDisconnected?: () => void;
  /** Callback on error */
  onError?: (error: unknown) => void;
}

/**
 * Provider component that initializes the MCP SDK
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <MCPProvider debug={true} onConnected={() => console.log('Connected!')}>
 *       <MyApp />
 *     </MCPProvider>
 *   );
 * }
 * ```
 */
export function MCPProvider({
  children,
  serverUrl,
  debug = false,
  autoConnect = true,
  onConnected,
  onDisconnected,
  onError,
}: MCPProviderProps): JSX.Element {
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Only initialize in browser and development
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production') {
      setIsInitialized(true);
      return;
    }

    const options: MCPBridgeOptions = {
      serverUrl,
      debug,
      autoConnect,
    };

    MCPBridge.initialize(options);
    setIsInitialized(true);

    // Set up event listeners
    const unsubConnect = MCPBridge.on('connected', () => {
      setIsConnected(true);
      onConnected?.();
    });

    const unsubDisconnect = MCPBridge.on('disconnected', () => {
      setIsConnected(false);
      onDisconnected?.();
    });

    const unsubError = MCPBridge.on('error', (error) => {
      onError?.(error);
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubError();
      MCPBridge.disconnect();
    };
  }, [serverUrl, debug, autoConnect, onConnected, onDisconnected, onError]);

  return (
    <MCPContext.Provider value={{ isConnected, isInitialized }}>
      {children}
    </MCPContext.Provider>
  );
}

/**
 * Hook to access MCP context
 * 
 * @example
 * ```tsx
 * function StatusIndicator() {
 *   const { isConnected, isInitialized } = useMCPContext();
 *   
 *   if (!isInitialized) return <span>Loading...</span>;
 *   return <span>{isConnected ? '🟢' : '🔴'}</span>;
 * }
 * ```
 */
export function useMCPContext(): MCPContextValue {
  return useContext(MCPContext);
}

/**
 * Component that shows MCP connection status
 * 
 * @example
 * ```tsx
 * <MCPStatusBadge />
 * ```
 */
export function MCPStatusBadge(): JSX.Element | null {
  const { isConnected, isInitialized } = useMCPContext();

  // Don't show in production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  if (!isInitialized) {
    return (
      <div style={badgeStyle}>
        <span style={{ ...dotStyle, backgroundColor: '#fbbf24' }} />
        <span>MCP Initializing...</span>
      </div>
    );
  }

  return (
    <div style={badgeStyle}>
      <span style={{ ...dotStyle, backgroundColor: isConnected ? '#22c55e' : '#ef4444' }} />
      <span>MCP {isConnected ? 'Connected' : 'Disconnected'}</span>
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  backgroundColor: '#1f2937',
  color: '#f9fafb',
  borderRadius: 8,
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  zIndex: 9999,
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
};

const dotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
};
