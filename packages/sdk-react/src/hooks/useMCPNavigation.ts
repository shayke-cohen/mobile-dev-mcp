/**
 * useMCPNavigation Hook
 * 
 * Tracks navigation state for AI awareness.
 */

import { useEffect } from 'react';
import { MCPBridge } from '../MCPBridge';

/**
 * Hook to track navigation state
 * 
 * @param route - Current route/path
 * @param params - Optional route parameters
 * 
 * @example
 * ```tsx
 * // With React Router
 * function App() {
 *   const location = useLocation();
 *   const params = useParams();
 *   
 *   useMCPNavigation(location.pathname, params);
 *   
 *   return <Routes>...</Routes>;
 * }
 * ```
 */
export function useMCPNavigation(
  route: string,
  params?: Record<string, unknown>
): void {
  useEffect(() => {
    MCPBridge.setNavigationState(route, params);
  }, [route, params]);
}

/**
 * Hook that automatically tracks browser location
 * 
 * @example
 * ```tsx
 * function App() {
 *   useMCPAutoNavigation();
 *   return <div>...</div>;
 * }
 * ```
 */
export function useMCPAutoNavigation(): void {
  useEffect(() => {
    // Set initial state
    MCPBridge.setNavigationState(window.location.pathname, {
      search: window.location.search,
      hash: window.location.hash,
    });

    // Listen for navigation changes
    const handlePopState = () => {
      MCPBridge.setNavigationState(window.location.pathname, {
        search: window.location.search,
        hash: window.location.hash,
      });
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
}
