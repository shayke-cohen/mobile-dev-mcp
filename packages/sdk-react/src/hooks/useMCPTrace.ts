/**
 * useMCPTrace Hook
 * 
 * Utilities for tracing function execution.
 */

import { useCallback, useRef } from 'react';
import { MCPBridge, TraceInfo } from '../MCPBridge';

/**
 * Hook that returns traced versions of functions
 * 
 * @example
 * ```tsx
 * function UserService() {
 *   const { traceAsync, traceSync } = useMCPTrace();
 *   
 *   const fetchUser = useCallback(async (id: string) => {
 *     return traceAsync('UserService.fetchUser', async () => {
 *       const response = await fetch(`/api/users/${id}`);
 *       return response.json();
 *     }, { args: { id } });
 *   }, [traceAsync]);
 *   
 *   return { fetchUser };
 * }
 * ```
 */
export function useMCPTrace() {
  const traceAsync = useCallback(
    async <T>(
      name: string,
      fn: () => Promise<T>,
      info: TraceInfo = {}
    ): Promise<T> => {
      return MCPBridge.traceAsync(name, fn, info);
    },
    []
  );

  const traceSync = useCallback(
    <T>(name: string, fn: () => T, info: TraceInfo = {}): T => {
      return MCPBridge.traceSync(name, fn, info);
    },
    []
  );

  const trace = useCallback((name: string, info: TraceInfo = {}): string => {
    return MCPBridge.trace(name, info);
  }, []);

  const traceReturn = useCallback(
    (name: string, returnValue?: unknown, error?: string): void => {
      MCPBridge.traceReturn(name, returnValue, error);
    },
    []
  );

  return { traceAsync, traceSync, trace, traceReturn };
}

/**
 * Hook that traces component render and lifecycle
 * 
 * @example
 * ```tsx
 * function ExpensiveComponent({ data }) {
 *   useMCPTraceRender('ExpensiveComponent');
 *   
 *   // Component render...
 *   return <div>...</div>;
 * }
 * ```
 */
export function useMCPTraceRender(componentName: string): void {
  const renderCount = useRef(0);
  
  renderCount.current++;
  
  // Trace the render
  MCPBridge.trace(`${componentName}.render`, {
    args: { renderCount: renderCount.current },
  });
  MCPBridge.traceReturn(`${componentName}.render`);
}

/**
 * Higher-order function to wrap a function with tracing
 * 
 * @example
 * ```tsx
 * const tracedFetch = withTrace('api.fetchData', async (url: string) => {
 *   const response = await fetch(url);
 *   return response.json();
 * });
 * ```
 */
export function withTrace<T extends (...args: unknown[]) => unknown>(
  name: string,
  fn: T
): T {
  return ((...args: unknown[]) => {
    const result = fn(...args);
    
    if (result instanceof Promise) {
      return MCPBridge.traceAsync(name, () => result, { args: { arguments: args } });
    } else {
      return MCPBridge.traceSync(name, () => result, { args: { arguments: args } });
    }
  }) as T;
}
