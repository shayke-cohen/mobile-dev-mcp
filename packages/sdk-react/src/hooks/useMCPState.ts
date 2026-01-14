/**
 * useMCPState Hook
 * 
 * Exposes React state to the MCP server for AI inspection.
 */

import { useEffect, useRef } from 'react';
import { MCPBridge } from '../MCPBridge';

/**
 * Hook to expose state to the MCP server
 * 
 * @param key - Unique key for this state
 * @param getter - Function that returns the current state value
 * 
 * @example
 * ```tsx
 * function CartPage() {
 *   const [cartItems, setCartItems] = useState([]);
 *   
 *   // Expose cart state to AI
 *   useMCPState('cart', () => cartItems);
 *   useMCPState('cartTotal', () => cartItems.reduce((sum, item) => sum + item.price, 0));
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
export function useMCPState<T>(key: string, getter: () => T): void {
  const getterRef = useRef(getter);
  
  // Keep getter ref updated
  useEffect(() => {
    getterRef.current = getter;
  }, [getter]);

  useEffect(() => {
    // Register state with a stable wrapper
    MCPBridge.exposeState(key, () => getterRef.current());

    return () => {
      MCPBridge.removeState(key);
    };
  }, [key]);
}

/**
 * Hook to expose multiple state values at once
 * 
 * @param states - Object mapping keys to getter functions
 * 
 * @example
 * ```tsx
 * function App() {
 *   const [user, setUser] = useState(null);
 *   const [cart, setCart] = useState([]);
 *   
 *   useMCPStates({
 *     user: () => user,
 *     cart: () => cart,
 *     isLoggedIn: () => !!user,
 *   });
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
export function useMCPStates(states: Record<string, () => unknown>): void {
  const statesRef = useRef(states);

  useEffect(() => {
    statesRef.current = states;
  }, [states]);

  useEffect(() => {
    const keys = Object.keys(statesRef.current);

    // Register all states
    for (const key of keys) {
      MCPBridge.exposeState(key, () => statesRef.current[key]());
    }

    return () => {
      for (const key of keys) {
        MCPBridge.removeState(key);
      }
    };
  }, []);
}
