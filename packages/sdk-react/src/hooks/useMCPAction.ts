/**
 * useMCPAction Hook
 * 
 * Registers actions that AI can trigger.
 */

import { useEffect, useRef, useCallback } from 'react';
import { MCPBridge } from '../MCPBridge';

type ActionHandler = (params: Record<string, unknown>) => unknown | Promise<unknown>;

/**
 * Hook to register an action that AI can trigger
 * 
 * @param name - Unique name for this action
 * @param handler - Function to execute when the action is triggered
 * 
 * @example
 * ```tsx
 * function CartPage() {
 *   const [cart, setCart] = useState([]);
 *   
 *   useMCPAction('addToCart', async (params) => {
 *     const product = await fetchProduct(params.productId);
 *     setCart(prev => [...prev, product]);
 *     return { success: true, product };
 *   });
 *   
 *   useMCPAction('clearCart', () => {
 *     setCart([]);
 *     return { success: true };
 *   });
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
export function useMCPAction(name: string, handler: ActionHandler): void {
  const handlerRef = useRef(handler);

  // Keep handler ref updated
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    // Register action with a stable wrapper
    MCPBridge.registerAction(name, (params) => handlerRef.current(params));

    return () => {
      MCPBridge.removeAction(name);
    };
  }, [name]);
}

/**
 * Hook to register multiple actions at once
 * 
 * @param actions - Object mapping action names to handlers
 * 
 * @example
 * ```tsx
 * function App() {
 *   const [user, setUser] = useState(null);
 *   
 *   useMCPActions({
 *     login: async (params) => {
 *       const user = await login(params.email, params.password);
 *       setUser(user);
 *       return { success: true, user };
 *     },
 *     logout: () => {
 *       setUser(null);
 *       return { success: true };
 *     },
 *   });
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
export function useMCPActions(actions: Record<string, ActionHandler>): void {
  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    const names = Object.keys(actionsRef.current);

    // Register all actions
    for (const name of names) {
      MCPBridge.registerAction(name, (params) => actionsRef.current[name](params));
    }

    return () => {
      for (const name of names) {
        MCPBridge.removeAction(name);
      }
    };
  }, []);
}

/**
 * Hook that returns a function to programmatically trigger an action
 * (for testing or internal use)
 */
export function useMCPTrigger(): (name: string, params?: Record<string, unknown>) => Promise<unknown> {
  return useCallback(async (name: string, params: Record<string, unknown> = {}) => {
    // This is mainly for testing - actions are usually triggered by the AI
    const handler = (MCPBridge as unknown as { actionHandlers: Map<string, ActionHandler> }).actionHandlers?.get(name);
    if (handler) {
      return handler(params);
    }
    throw new Error(`Action not found: ${name}`);
  }, []);
}
