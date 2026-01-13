/**
 * Products State Slice
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  rating: number;
  inStock: boolean;
}

interface ProductsState {
  items: Product[];
  selectedProduct: Product | null;
  isLoading: boolean;
  error: string | null;
  categories: string[];
  selectedCategory: string | null;
}

const initialState: ProductsState = {
  items: [],
  selectedProduct: null,
  isLoading: false,
  error: null,
  categories: [],
  selectedCategory: null,
};

// Mock API call
export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (_, { rejectWithValue }) => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock products data
      const products: Product[] = [
        {
          id: '1',
          name: 'Wireless Headphones',
          description: 'High-quality wireless headphones with noise cancellation',
          price: 149.99,
          imageUrl: 'https://picsum.photos/200/200?random=1',
          category: 'Electronics',
          rating: 4.5,
          inStock: true,
        },
        {
          id: '2',
          name: 'Smart Watch',
          description: 'Feature-rich smartwatch with health tracking',
          price: 299.99,
          imageUrl: 'https://picsum.photos/200/200?random=2',
          category: 'Electronics',
          rating: 4.8,
          inStock: true,
        },
        {
          id: '3',
          name: 'Running Shoes',
          description: 'Comfortable running shoes for everyday training',
          price: 89.99,
          imageUrl: 'https://picsum.photos/200/200?random=3',
          category: 'Sports',
          rating: 4.3,
          inStock: true,
        },
        {
          id: '4',
          name: 'Laptop Stand',
          description: 'Ergonomic aluminum laptop stand',
          price: 49.99,
          imageUrl: 'https://picsum.photos/200/200?random=4',
          category: 'Office',
          rating: 4.6,
          inStock: false,
        },
        {
          id: '5',
          name: 'Coffee Maker',
          description: 'Automatic coffee maker with timer',
          price: 79.99,
          imageUrl: 'https://picsum.photos/200/200?random=5',
          category: 'Home',
          rating: 4.2,
          inStock: true,
        },
      ];
      
      return products;
    } catch (error) {
      return rejectWithValue('Failed to fetch products');
    }
  }
);

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    selectProduct: (state, action: PayloadAction<string>) => {
      state.selectedProduct = state.items.find(p => p.id === action.payload) || null;
    },
    clearSelectedProduct: (state) => {
      state.selectedProduct = null;
    },
    setCategory: (state, action: PayloadAction<string | null>) => {
      state.selectedCategory = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.items = action.payload;
        state.categories = [...new Set(action.payload.map(p => p.category))];
        state.isLoading = false;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { selectProduct, clearSelectedProduct, setCategory } = productsSlice.actions;
export default productsSlice.reducer;
