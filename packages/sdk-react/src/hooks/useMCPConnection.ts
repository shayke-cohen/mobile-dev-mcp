/**
 * useMCPConnection Hook
 * 
 * Provides connection status and control.
 */

import { useState, useEffect, useCallback } from 'react';
import { MCPBridge } from '../MCPBridge';

interface MCPConnectionState {
  isConnected: boolean;
  reconnect: () => void;
  disconnect: () => void;
}

/**
 * Hook to monitor and control MCP connection
 * 
 * @example
 * ```tsx
 * function ConnectionStatus() {
 *   const { isConnected, reconnect } = useMCPConnection();
 *   
 *   return (
 *     <div>
 *       {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
 *       {!isConnected && <button onClick={reconnect}>Reconnect</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMCPConnection(): MCPConnectionState {
  const [isConnected, setIsConnected] = useState(MCPBridge.getIsConnected());

  useEffect(() => {
    const unsubConnect = MCPBridge.on('connected', () => {
      setIsConnected(true);
    });

    const unsubDisconnect = MCPBridge.on('disconnected', () => {
      setIsConnected(false);
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, []);

  const reconnect = useCallback(() => {
    MCPBridge.connect();
  }, []);

  const disconnect = useCallback(() => {
    MCPBridge.disconnect();
  }, []);

  return { isConnected, reconnect, disconnect };
}
