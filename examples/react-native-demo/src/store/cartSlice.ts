/**
 * Cart State Slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
  promoCode: string | null;
  discount: number;
}

const initialState: CartState = {
  items: [],
  total: 0,
  itemCount: 0,
  promoCode: null,
  discount: 0,
};

const calculateTotals = (items: CartItem[], discount: number) => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal - discount;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { total: Math.max(0, total), itemCount };
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action: PayloadAction<CartItem>) => {
      const existingItem = state.items.find(item => item.productId === action.payload.productId);
      
      if (existingItem) {
        existingItem.quantity += action.payload.quantity;
      } else {
        state.items.push(action.payload);
      }
      
      const { total, itemCount } = calculateTotals(state.items, state.discount);
      state.total = total;
      state.itemCount = itemCount;
    },
    removeItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.productId !== action.payload);
      const { total, itemCount } = calculateTotals(state.items, state.discount);
      state.total = total;
      state.itemCount = itemCount;
    },
    updateQuantity: (state, action: PayloadAction<{ productId: string; quantity: number }>) => {
      const item = state.items.find(item => item.productId === action.payload.productId);
      if (item) {
        item.quantity = Math.max(1, action.payload.quantity);
      }
      const { total, itemCount } = calculateTotals(state.items, state.discount);
      state.total = total;
      state.itemCount = itemCount;
    },
    applyPromoCode: (state, action: PayloadAction<{ code: string; discount: number }>) => {
      state.promoCode = action.payload.code;
      state.discount = action.payload.discount;
      const { total, itemCount } = calculateTotals(state.items, state.discount);
      state.total = total;
      state.itemCount = itemCount;
    },
    clearCart: (state) => {
      state.items = [];
      state.total = 0;
      state.itemCount = 0;
      state.promoCode = null;
      state.discount = 0;
    },
  },
});

export const { addItem, removeItem, updateQuantity, applyPromoCode, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
