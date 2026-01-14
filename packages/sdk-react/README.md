# @mobile-dev-mcp/react

React SDK for Mobile Dev MCP - enables AI-assisted web development in Cursor IDE.

[![npm version](https://img.shields.io/npm/v/@mobile-dev-mcp/react.svg)](https://www.npmjs.com/package/@mobile-dev-mcp/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔍 **State Exposure** - Let AI see your React state
- 🎮 **Action Registration** - Let AI trigger functions
- 🌳 **Component Registration** - Let AI find and interact with UI
- 🧭 **Navigation Tracking** - Let AI know current route
- 🔬 **Function Tracing** - Debug function calls with AI
- 📊 **Network Monitoring** - Track API calls automatically
- 🚩 **Feature Flags** - Toggle features for testing
- 📝 **Console Capture** - AI sees console logs

## Installation

```bash
yarn add @mobile-dev-mcp/react
```

## Quick Start

```tsx
import { MCPProvider, useMCPState, useMCPAction } from '@mobile-dev-mcp/react';

function App() {
  return (
    <MCPProvider debug={true}>
      <MyApp />
    </MCPProvider>
  );
}

function MyApp() {
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);

  // Expose state to AI
  useMCPState('cart', () => cart);
  useMCPState('user', () => user);
  useMCPState('isLoggedIn', () => !!user);

  // Register actions AI can trigger
  useMCPAction('addToCart', async (params) => {
    const product = await fetchProduct(params.productId);
    setCart(prev => [...prev, product]);
    return { success: true, product };
  });

  useMCPAction('login', async (params) => {
    const user = await login(params.email, params.password);
    setUser(user);
    return { success: true, user };
  });

  return <div>...</div>;
}
```

## Provider

Wrap your app with `MCPProvider` to initialize the SDK:

```tsx
import { MCPProvider, MCPStatusBadge } from '@mobile-dev-mcp/react';

function App() {
  return (
    <MCPProvider
      serverUrl="ws://localhost:8765"  // Optional, this is the default
      debug={true}                      // Enable debug logging
      autoConnect={true}                // Auto-connect on mount
      onConnected={() => console.log('Connected!')}
      onDisconnected={() => console.log('Disconnected')}
      onError={(error) => console.error(error)}
    >
      <MyApp />
      <MCPStatusBadge />  {/* Optional status indicator */}
    </MCPProvider>
  );
}
```

## Hooks

### `useMCPState` - Expose State

```tsx
function CartPage() {
  const [items, setItems] = useState([]);
  
  // Single state
  useMCPState('cartItems', () => items);
  useMCPState('cartTotal', () => items.reduce((sum, i) => sum + i.price, 0));
  
  return <div>...</div>;
}

// Or expose multiple states at once
function App() {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  
  useMCPStates({
    user: () => user,
    cart: () => cart,
    isLoggedIn: () => !!user,
    cartCount: () => cart.length,
  });
  
  return <div>...</div>;
}
```

### `useMCPAction` - Register Actions

```tsx
function CartPage() {
  const [cart, setCart] = useState([]);
  
  useMCPAction('addToCart', async ({ productId }) => {
    const product = await api.getProduct(productId);
    setCart(prev => [...prev, product]);
    return { added: product.name };
  });
  
  useMCPAction('clearCart', () => {
    setCart([]);
    return { cleared: true };
  });
  
  return <div>...</div>;
}

// Or register multiple actions at once
useMCPActions({
  addToCart: async (params) => { /* ... */ },
  removeFromCart: (params) => { /* ... */ },
  checkout: async (params) => { /* ... */ },
});
```

### `useMCPComponent` - Register UI Components

```tsx
function AddToCartButton({ product, onAdd }) {
  // Register for AI interaction
  const ref = useMCPComponent('add-to-cart-btn', {
    type: 'Button',
    props: { productId: product.id },
    getText: () => 'Add to Cart',
    onTap: () => onAdd(product),
  });
  
  return (
    <button ref={ref} data-testid="add-to-cart-btn" onClick={() => onAdd(product)}>
      Add to Cart
    </button>
  );
}

// Shorthand for buttons
function SubmitButton({ onSubmit }) {
  const ref = useMCPButton('submit-btn', onSubmit, 'Submit');
  return <button ref={ref}>Submit</button>;
}

// Shorthand for text
function Title({ children }) {
  const ref = useMCPText('page-title', () => children);
  return <h1 ref={ref}>{children}</h1>;
}
```

### `useMCPNavigation` - Track Navigation

```tsx
// With React Router
import { useLocation, useParams } from 'react-router-dom';

function App() {
  const location = useLocation();
  const params = useParams();
  
  useMCPNavigation(location.pathname, params);
  
  return <Routes>...</Routes>;
}

// Or auto-track browser location
function App() {
  useMCPAutoNavigation();
  return <div>...</div>;
}
```

### `useMCPTrace` - Function Tracing

```tsx
function useApi() {
  const { traceAsync, traceSync } = useMCPTrace();
  
  const fetchUser = useCallback(async (id) => {
    return traceAsync('api.fetchUser', async () => {
      const response = await fetch(`/api/users/${id}`);
      return response.json();
    }, { args: { id } });
  }, [traceAsync]);
  
  const calculateTotal = useCallback((items) => {
    return traceSync('cart.calculateTotal', () => {
      return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }, { args: { itemCount: items.length } });
  }, [traceSync]);
  
  return { fetchUser, calculateTotal };
}
```

### `useMCPConnection` - Connection Status

```tsx
function ConnectionIndicator() {
  const { isConnected, reconnect, disconnect } = useMCPConnection();
  
  return (
    <div>
      <span>{isConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
      {!isConnected && <button onClick={reconnect}>Reconnect</button>}
    </div>
  );
}
```

## DOM Integration

The SDK automatically scans the DOM for elements with `data-testid` attributes:

```tsx
function ProductCard({ product }) {
  return (
    <div data-testid={`product-${product.id}`}>
      <h3 data-testid={`product-title-${product.id}`}>{product.name}</h3>
      <span data-testid={`product-price-${product.id}`}>${product.price}</span>
      <button data-testid={`add-to-cart-${product.id}`}>Add to Cart</button>
    </div>
  );
}
```

AI can find and interact with these elements using tools like `find_element` and `simulate_interaction`.

## Auto-Instrumentation

Use the Babel plugin for automatic function tracing:

```javascript
// babel.config.js
module.exports = {
  plugins: [
    ['@mobile-dev-mcp/babel-plugin', {
      traceClasses: true,
      traceAsync: true,
    }]
  ]
};
```

## Network Monitoring

The SDK automatically intercepts `fetch` calls:

```tsx
// These are automatically tracked
await fetch('/api/users');
await fetch('/api/products', { method: 'POST', body: JSON.stringify(data) });

// AI can see all requests via get_network_requests tool
```

## Network Mocking

Create mocks for testing:

```tsx
// Via MCP tools, AI can:
// 1. mock_network_request - Create a mock
// 2. clear_network_mocks - Clear all mocks

// The SDK will intercept matching requests and return mock responses
```

## Feature Flags

```tsx
import { MCPBridge } from '@mobile-dev-mcp/react';

// Register flags
MCPBridge.registerFeatureFlags({
  darkMode: true,
  newCheckout: false,
  experimentalFeatures: false,
});

// Use flags
function App() {
  const darkMode = MCPBridge.getFeatureFlag('darkMode');
  return <div className={darkMode ? 'dark' : 'light'}>...</div>;
}

// AI can toggle flags via toggle_feature_flag tool
```

## API Reference

### MCPBridge Methods

| Method | Description |
|--------|-------------|
| `initialize(options)` | Initialize the SDK |
| `connect()` | Connect to MCP server |
| `disconnect()` | Disconnect from server |
| `exposeState(key, getter)` | Expose state |
| `registerAction(name, handler)` | Register action |
| `registerComponent(testId, type, options)` | Register component |
| `setNavigationState(route, params)` | Set navigation |
| `trace(name, info)` | Start a trace |
| `traceReturn(name, result, error)` | End a trace |
| `traceAsync(name, fn, info)` | Trace async function |
| `traceSync(name, fn, info)` | Trace sync function |
| `registerFeatureFlags(flags)` | Register feature flags |
| `getFeatureFlag(key)` | Get flag value |

### Hooks

| Hook | Description |
|------|-------------|
| `useMCPState(key, getter)` | Expose state |
| `useMCPStates(states)` | Expose multiple states |
| `useMCPAction(name, handler)` | Register action |
| `useMCPActions(actions)` | Register multiple actions |
| `useMCPComponent(testId, options)` | Register component |
| `useMCPButton(testId, onClick, text)` | Register button |
| `useMCPText(testId, getText)` | Register text |
| `useMCPNavigation(route, params)` | Track navigation |
| `useMCPAutoNavigation()` | Auto-track location |
| `useMCPTrace()` | Get tracing functions |
| `useMCPConnection()` | Get connection state |

## Requirements

- React 17.0.0+
- Modern browser with WebSocket support
- MCP server running on localhost:8765

## Security

- SDK only active in development (`process.env.NODE_ENV !== 'production'`)
- All communication via localhost WebSocket
- No external data transmission
- Production builds exclude SDK functionality

## License

MIT
