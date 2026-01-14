/**
 * MCP Demo Store - React Web App
 * 
 * Demonstrates the @mobile-dev-mcp/react SDK integration.
 */

import { useState, useCallback } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  useMCPStates,
  useMCPActions,
  useMCPNavigation,
  useMCPTrace,
  MCPBridge,
} from '@mobile-dev-mcp/react';

// Types
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
}

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

// Mock products
const PRODUCTS: Product[] = [
  { id: '1', name: 'Wireless Headphones', description: 'High-quality wireless headphones with noise cancellation', price: 149.99, category: 'Electronics', inStock: true },
  { id: '2', name: 'Smart Watch', description: 'Feature-rich smartwatch with health tracking', price: 299.99, category: 'Electronics', inStock: true },
  { id: '3', name: 'Running Shoes', description: 'Comfortable running shoes for everyday training', price: 89.99, category: 'Sports', inStock: true },
  { id: '4', name: 'Laptop Stand', description: 'Ergonomic aluminum laptop stand', price: 49.99, category: 'Office', inStock: false },
  { id: '5', name: 'Coffee Maker', description: 'Automatic coffee maker with timer', price: 79.99, category: 'Home', inStock: true },
];

// Register feature flags
MCPBridge.registerFeatureFlags({
  darkMode: false,
  showRecommendations: true,
  newCheckout: false,
});

export default function App() {
  const location = useLocation();
  const { traceSync } = useMCPTrace();
  
  // App state
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products] = useState<Product[]>(PRODUCTS);

  // Track navigation
  useMCPNavigation(location.pathname);

  // Expose state to AI
  useMCPStates({
    user: () => user,
    isLoggedIn: () => !!user,
    cart: () => cart,
    cartTotal: () => traceSync('calculateCartTotal', () => 
      cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    ),
    cartCount: () => cart.reduce((sum, item) => sum + item.quantity, 0),
    products: () => products,
  });

  // Register actions for AI
  const addToCart = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.inStock) {
      throw new Error(`Product ${productId} not found or out of stock`);
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        return prev.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { productId, name: product.name, price: product.price, quantity: 1 }];
    });

    return { added: product.name, productId };
  }, [products]);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
    return { removed: productId };
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    return { cleared: true };
  }, []);

  const login = useCallback(() => {
    const newUser = { id: 'user_123', name: 'John Doe', email: 'john@example.com' };
    setUser(newUser);
    return { loggedIn: true, user: newUser };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    return { loggedOut: true };
  }, []);

  useMCPActions({
    addToCart: (params) => addToCart(params.productId as string),
    removeFromCart: (params) => removeFromCart(params.productId as string),
    clearCart: () => clearCart(),
    login: () => login(),
    logout: () => logout(),
    navigate: (params) => {
      window.location.href = params.route as string;
      return { navigatedTo: params.route };
    },
  });

  return (
    <div className="app">
      {/* Navigation */}
      <nav style={navStyle}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={logoStyle} data-testid="app-logo">
            🛍️ MCP Demo Store
          </Link>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link to="/" style={navLinkStyle} data-testid="nav-home">Home</Link>
            <Link to="/products" style={navLinkStyle} data-testid="nav-products">Products</Link>
            <Link to="/cart" style={navLinkStyle} data-testid="nav-cart">
              Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})
            </Link>
            {user ? (
              <button onClick={logout} className="btn btn-secondary" data-testid="logout-button">
                Logout
              </button>
            ) : (
              <button onClick={login} className="btn btn-primary" data-testid="login-button">
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container" style={{ padding: '2rem 1rem' }}>
        <Routes>
          <Route path="/" element={<HomePage user={user} cart={cart} />} />
          <Route path="/products" element={<ProductsPage products={products} onAddToCart={addToCart} />} />
          <Route path="/cart" element={<CartPage cart={cart} onRemove={removeFromCart} onClear={clearCart} />} />
        </Routes>
      </main>
    </div>
  );
}

// ==================== Pages ====================

function HomePage({ user, cart }: { user: User | null; cart: CartItem[] }) {
  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }} data-testid="welcome-banner">
        <h1 data-testid="welcome-text">
          Welcome{user ? `, ${user.name}` : ''}! 👋
        </h1>
        <p style={{ color: 'var(--gray-500)', marginTop: '0.5rem' }}>
          This is a demo React web app integrated with Mobile Dev MCP.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" data-testid="stat-products">
          <h3>🛒 Products</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{PRODUCTS.length}</p>
        </div>
        <div className="card" data-testid="stat-cart">
          <h3>🛍️ Cart Items</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
            {cart.reduce((sum, item) => sum + item.quantity, 0)}
          </p>
        </div>
        <div className="card" data-testid="stat-total">
          <h3>💰 Cart Total</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
            ${cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProductsPage({ products, onAddToCart }: { products: Product[]; onAddToCart: (id: string) => void }) {
  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }} data-testid="products-title">Products</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {products.map(product => (
          <div key={product.id} className="card" data-testid={`product-${product.id}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <h3 data-testid={`product-name-${product.id}`}>{product.name}</h3>
              <span className={`badge ${product.inStock ? 'badge-success' : 'badge-primary'}`}>
                {product.inStock ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>
            <p style={{ color: 'var(--gray-500)', margin: '0.5rem 0' }}>{product.description}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              ${product.price.toFixed(2)}
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => onAddToCart(product.id)}
              disabled={!product.inStock}
              data-testid={`add-to-cart-${product.id}`}
            >
              {product.inStock ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CartPage({ cart, onRemove, onClear }: { cart: CartItem[]; onRemove: (id: string) => void; onClear: () => void }) {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 data-testid="cart-title">Shopping Cart</h1>
        {cart.length > 0 && (
          <button className="btn btn-danger" onClick={onClear} data-testid="clear-cart-button">
            Clear Cart
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="card" data-testid="empty-cart">
          <p style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Your cart is empty</p>
        </div>
      ) : (
        <>
          {cart.map(item => (
            <div key={item.productId} className="card" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} data-testid={`cart-item-${item.productId}`}>
              <div>
                <h3>{item.name}</h3>
                <p style={{ color: 'var(--gray-500)' }}>
                  ${item.price.toFixed(2)} × {item.quantity} = ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => onRemove(item.productId)} data-testid={`remove-${item.productId}`}>
                Remove
              </button>
            </div>
          ))}

          <div className="card" style={{ marginTop: '1.5rem' }} data-testid="cart-summary">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Total</h2>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }} data-testid="cart-total">
                ${total.toFixed(2)}
              </p>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} data-testid="checkout-button">
              Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Styles
const navStyle: React.CSSProperties = {
  background: 'white',
  padding: '1rem 0',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  position: 'sticky',
  top: 0,
  zIndex: 100,
};

const logoStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 'bold',
  color: 'var(--primary)',
  textDecoration: 'none',
};

const navLinkStyle: React.CSSProperties = {
  color: 'var(--gray-700)',
  textDecoration: 'none',
  fontWeight: 500,
};
