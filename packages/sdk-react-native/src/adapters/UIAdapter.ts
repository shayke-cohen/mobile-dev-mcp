/**
 * UIAdapter - Handles UI inspection and interaction using native modules
 */

import { NativeModules, Platform } from 'react-native';

const { MCPNativeModule } = NativeModules;

export class UIAdapter {
  private navigationRef: { current: unknown } | null = null;

  /**
   * Set navigation ref for programmatic navigation
   */
  setNavigationRef(ref: { current: unknown }): void {
    this.navigationRef = ref;
  }

  /**
   * Capture screenshot
   */
  async captureScreenshot(params: { label?: string }): Promise<Record<string, unknown>> {
    try {
      if (!MCPNativeModule?.captureScreenshot) {
        return {
          error: 'Native module not available. Ensure MCPNativePackage is added to your MainApplication.',
          platform: Platform.OS,
          label: params.label,
          timestamp: new Date().toISOString(),
        };
      }

      const result = await MCPNativeModule.captureScreenshot();
      return {
        ...result,
        label: params.label,
      };
    } catch (error) {
      return {
        error: `Failed to capture screenshot: ${error instanceof Error ? error.message : 'Unknown'}`,
        label: params.label,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get view hierarchy / layout tree
   */
  async getLayoutTree(params: { includeHidden?: boolean; maxDepth?: number }): Promise<Record<string, unknown>> {
    const { includeHidden = false, maxDepth = 20 } = params;

    try {
      if (!MCPNativeModule?.getViewHierarchy) {
        return {
          error: 'Native module not available. Ensure MCPNativePackage is added to your MainApplication.',
          platform: Platform.OS,
          timestamp: new Date().toISOString(),
        };
      }

      const result = await MCPNativeModule.getViewHierarchy({
        maxDepth,
        includeHidden,
      });

      return result;
    } catch (error) {
      return {
        error: `Failed to get layout tree: ${error instanceof Error ? error.message : 'Unknown'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get component tree (alias for getLayoutTree with React Native view info)
   */
  async getComponentTree(params: { depth?: number; includeProps?: boolean; includeState?: boolean }): Promise<Record<string, unknown>> {
    return this.getLayoutTree({
      maxDepth: params.depth,
      includeHidden: false,
    });
  }

  /**
   * Find element by testID
   */
  async findElementByTestId(testId: string): Promise<Record<string, unknown>> {
    try {
      if (!MCPNativeModule?.findElementByTestId) {
        return {
          error: 'Native module not available',
          testId,
          timestamp: new Date().toISOString(),
        };
      }

      return await MCPNativeModule.findElementByTestId(testId);
    } catch (error) {
      return {
        error: `Failed to find element: ${error instanceof Error ? error.message : 'Unknown'}`,
        testId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Simulate user interaction
   */
  async simulateInteraction(params: {
    type: 'tap' | 'longPress' | 'swipe' | 'input';
    target: { x?: number; y?: number; testId?: string };
    value?: string;
    direction?: 'up' | 'down' | 'left' | 'right';
    duration?: number;
  }): Promise<Record<string, unknown>> {
    const { type, target, value, direction, duration = 500 } = params;

    try {
      // If testId provided, find element first
      let x = target.x;
      let y = target.y;

      if (target.testId && (x === undefined || y === undefined)) {
        const element = await this.findElementByTestId(target.testId);
        if (!element.found) {
          return {
            error: `Element with testID "${target.testId}" not found`,
            timestamp: new Date().toISOString(),
          };
        }
        const center = element.center as { x: number; y: number };
        x = center.x;
        y = center.y;
      }

      if (x === undefined || y === undefined) {
        return {
          error: 'Target coordinates or testId required',
          timestamp: new Date().toISOString(),
        };
      }

      switch (type) {
        case 'tap':
          if (!MCPNativeModule?.simulateTap) {
            return { error: 'Native module not available', timestamp: new Date().toISOString() };
          }
          return await MCPNativeModule.simulateTap(x, y);

        case 'longPress':
          if (!MCPNativeModule?.simulateLongPress) {
            return { error: 'Native module not available', timestamp: new Date().toISOString() };
          }
          return await MCPNativeModule.simulateLongPress(x, y, duration);

        case 'swipe':
          if (!MCPNativeModule?.simulateSwipe) {
            return { error: 'Native module not available', timestamp: new Date().toISOString() };
          }
          const swipeDistance = 300;
          let endX = x;
          let endY = y;
          switch (direction) {
            case 'up': endY = y - swipeDistance; break;
            case 'down': endY = y + swipeDistance; break;
            case 'left': endX = x - swipeDistance; break;
            case 'right': endX = x + swipeDistance; break;
          }
          return await MCPNativeModule.simulateSwipe(x, y, endX, endY, duration);

        case 'input':
          if (!value) {
            return { error: 'Value required for input type', timestamp: new Date().toISOString() };
          }
          // First tap to focus
          if (MCPNativeModule?.simulateTap) {
            await MCPNativeModule.simulateTap(x, y);
          }
          // Then type
          if (!MCPNativeModule?.typeText) {
            return { error: 'Native module not available', timestamp: new Date().toISOString() };
          }
          return await MCPNativeModule.typeText(value);

        default:
          return {
            error: `Unknown interaction type: ${type}`,
            timestamp: new Date().toISOString(),
          };
      }
    } catch (error) {
      return {
        error: `Failed to simulate interaction: ${error instanceof Error ? error.message : 'Unknown'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Navigate to a route
   */
  async navigateTo(params: { route: string; params?: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const { route, params: routeParams } = params;

    try {
      if (!this.navigationRef?.current) {
        return {
          error: 'Navigation ref not set. Call MCPBridge.setNavigationRef(navigationRef) first.',
          requestedRoute: route,
          timestamp: new Date().toISOString(),
        };
      }

      const nav = this.navigationRef.current as {
        navigate?: (route: string, params?: unknown) => void;
        dispatch?: (action: unknown) => void;
      };

      if (nav.navigate) {
        nav.navigate(route, routeParams);
        return {
          success: true,
          route,
          params: routeParams,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        error: 'Navigation ref does not have navigate method',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: `Failed to navigate: ${error instanceof Error ? error.message : 'Unknown'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Inspect element at coordinates
   */
  async inspectElement(params: { x: number; y: number }): Promise<Record<string, unknown>> {
    try {
      // Get full hierarchy and find element at point
      const hierarchy = await this.getLayoutTree({ includeHidden: false, maxDepth: 30 });
      
      if (hierarchy.error) {
        return hierarchy;
      }

      const element = this.findElementAtPoint(hierarchy.tree as ViewNode, params.x, params.y);
      
      return {
        element: element || null,
        point: { x: params.x, y: params.y },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: `Failed to inspect element: ${error instanceof Error ? error.message : 'Unknown'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private findElementAtPoint(node: ViewNode, x: number, y: number): ViewNode | null {
    if (!node) return null;

    const pos = node.screenPosition || node.frame;
    if (!pos) return null;

    const frame = node.frame;
    if (!frame) return null;

    // Check if point is within this node
    const inBounds = 
      x >= pos.x && 
      x <= pos.x + frame.width && 
      y >= pos.y && 
      y <= pos.y + frame.height;

    if (!inBounds) return null;

    // Check children (last child that contains point wins - it's on top)
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const found = this.findElementAtPoint(node.children[i], x, y);
        if (found) return found;
      }
    }

    return node;
  }
}

interface ViewNode {
  type: string;
  frame?: { x: number; y: number; width: number; height: number };
  screenPosition?: { x: number; y: number };
  children?: ViewNode[];
  [key: string]: unknown;
}
