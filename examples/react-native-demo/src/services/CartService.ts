/**
 * CartService - Business logic for cart operations
 * 
 * This class is traced by the MCP Babel plugin.
 * All public methods will appear in get_traces() during debugging.
 */

import { store } from '../store';
import { addItem, removeItem, updateQuantity, clearCart, applyPromoCode } from '../store/cartSlice';

// Product type for cart operations
interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
}

/**
 * Cart service with traced methods for debugging
 */
export class CartService {
  
  /**
   * Add a product to the cart
   * Traced: appears in get_traces() with args
   */
  addToCart(product: Product, quantity: number = 1): void {
    // Validate product
    if (!product.id || !product.name) {
      throw new Error('Invalid product: missing id or name');
    }
    
    if (quantity < 1) {
      throw new Error('Quantity must be at least 1');
    }
    
    // Dispatch to Redux store
    store.dispatch(addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      imageUrl: product.imageUrl,
    }));
    
    console.log(`[CartService] Added ${quantity}x ${product.name} to cart`);
  }
  
  /**
   * Remove a product from the cart
   * Traced: appears in get_traces()
   */
  removeFromCart(productId: string): void {
    if (!productId) {
      throw new Error('Product ID is required');
    }
    
    store.dispatch(removeItem(productId));
    console.log(`[CartService] Removed product ${productId} from cart`);
  }
  
  /**
   * Update quantity of a cart item
   * Traced: appears in get_traces() with args
   */
  updateItemQuantity(productId: string, newQuantity: number): void {
    if (!productId) {
      throw new Error('Product ID is required');
    }
    
    if (newQuantity < 0) {
      throw new Error('Quantity cannot be negative');
    }
    
    if (newQuantity === 0) {
      this.removeFromCart(productId);
      return;
    }
    
    store.dispatch(updateQuantity({ productId, quantity: newQuantity }));
    console.log(`[CartService] Updated ${productId} quantity to ${newQuantity}`);
  }
  
  /**
   * Clear all items from the cart
   * Traced: appears in get_traces()
   */
  clearAllItems(): void {
    store.dispatch(clearCart());
    console.log('[CartService] Cart cleared');
  }
  
  /**
   * Apply a promo code to the cart
   * Traced: appears in get_traces() with args
   */
  async applyPromoCodeAsync(code: string): Promise<{ success: boolean; discount: number }> {
    if (!code || code.trim().length === 0) {
      throw new Error('Promo code is required');
    }
    
    // Simulate API call to validate promo code
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock promo codes
    const promoCodes: Record<string, number> = {
      'SAVE10': 10,
      'SAVE20': 20,
      'HALF': 50,
    };
    
    const discount = promoCodes[code.toUpperCase()];
    
    if (!discount) {
      throw new Error(`Invalid promo code: ${code}`);
    }
    
    store.dispatch(applyPromoCode({ code: code.toUpperCase(), discount }));
    console.log(`[CartService] Applied promo code ${code} for $${discount} discount`);
    
    return { success: true, discount };
  }
  
  /**
   * Calculate cart total with optional tax
   * Traced: shows calculation logic
   */
  calculateTotal(taxRate: number = 0): { subtotal: number; tax: number; total: number } {
    const state = store.getState().cart;
    const subtotal = state.total;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax - state.discount;
    
    console.log(`[CartService] Calculated total: $${total.toFixed(2)}`);
    
    return {
      subtotal,
      tax,
      total: Math.max(0, total),
    };
  }
  
  /**
   * Get cart summary for debugging
   * Traced: useful for state inspection
   */
  getCartSummary(): { itemCount: number; totalValue: number; items: string[] } {
    const state = store.getState().cart;
    
    return {
      itemCount: state.itemCount,
      totalValue: state.total,
      items: state.items.map(item => `${item.name} x${item.quantity}`),
    };
  }
}

// Export singleton instance
export const cartService = new CartService();
