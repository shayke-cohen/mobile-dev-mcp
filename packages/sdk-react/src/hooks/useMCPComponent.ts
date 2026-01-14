/**
 * useMCPComponent Hook
 * 
 * Registers a React component for AI inspection and interaction.
 */

import { useEffect, useRef, useCallback, RefObject } from 'react';
import { MCPBridge } from '../MCPBridge';

interface MCPComponentOptions {
  /** Component type (e.g., 'Button', 'Input', 'Text') */
  type: string;
  /** Additional props to expose */
  props?: Record<string, unknown>;
  /** Function to get the component's text content */
  getText?: () => string | null;
  /** Function to call when AI triggers a tap */
  onTap?: () => void;
}

/**
 * Hook to register a component for AI inspection
 * 
 * @param testId - Unique test ID for this component
 * @param options - Component options
 * @returns A ref to attach to the DOM element
 * 
 * @example
 * ```tsx
 * function AddToCartButton({ product }) {
 *   const ref = useMCPComponent('add-to-cart-btn', {
 *     type: 'Button',
 *     props: { productId: product.id },
 *     getText: () => 'Add to Cart',
 *     onTap: () => addToCart(product),
 *   });
 *   
 *   return (
 *     <button ref={ref} data-testid="add-to-cart-btn">
 *       Add to Cart
 *     </button>
 *   );
 * }
 * ```
 */
export function useMCPComponent<T extends HTMLElement = HTMLElement>(
  testId: string,
  options: MCPComponentOptions
): RefObject<T> {
  const ref = useRef<T>(null);
  const optionsRef = useRef(options);

  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    // Register component
    MCPBridge.registerComponent(testId, optionsRef.current.type, {
      element: ref.current || undefined,
      props: optionsRef.current.props,
      getText: optionsRef.current.getText,
      onTap: optionsRef.current.onTap,
    });

    return () => {
      MCPBridge.unregisterComponent(testId);
    };
  }, [testId]);

  // Update element reference when ref changes
  useEffect(() => {
    if (ref.current) {
      MCPBridge.updateComponentElement(testId, ref.current);
    }
  });

  return ref;
}

/**
 * Hook to register a simple button component
 * 
 * @example
 * ```tsx
 * function SubmitButton({ onSubmit }) {
 *   const ref = useMCPButton('submit-btn', onSubmit, 'Submit');
 *   return <button ref={ref}>Submit</button>;
 * }
 * ```
 */
export function useMCPButton(
  testId: string,
  onClick: () => void,
  text?: string
): RefObject<HTMLButtonElement> {
  return useMCPComponent<HTMLButtonElement>(testId, {
    type: 'Button',
    onTap: onClick,
    getText: text ? () => text : undefined,
  });
}

/**
 * Hook to register a text component
 * 
 * @example
 * ```tsx
 * function Title({ children }) {
 *   const ref = useMCPText('page-title', () => children);
 *   return <h1 ref={ref}>{children}</h1>;
 * }
 * ```
 */
export function useMCPText(
  testId: string,
  getText: () => string | null
): RefObject<HTMLElement> {
  return useMCPComponent<HTMLElement>(testId, {
    type: 'Text',
    getText,
  });
}

/**
 * Hook to make any element with data-testid interactable
 * 
 * @example
 * ```tsx
 * function ProductCard({ product, onAddToCart }) {
 *   useMCPClickable(`product-${product.id}`, onAddToCart);
 *   
 *   return (
 *     <div data-testid={`product-${product.id}`}>
 *       {product.name}
 *       <button onClick={onAddToCart}>Add</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useMCPClickable(testId: string, onClick: () => void): void {
  useEffect(() => {
    MCPBridge.registerComponent(testId, 'Clickable', {
      onTap: onClick,
    });

    return () => {
      MCPBridge.unregisterComponent(testId);
    };
  }, [testId, onClick]);
}
