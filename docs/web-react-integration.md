# React Web Integration

This guide covers integrating Mobile Dev MCP with React web applications.

## Overview

The `@mobile-dev-mcp/react` SDK enables AI-assisted debugging for React web applications in Cursor IDE. It provides the same powerful features as the mobile SDKs, adapted for the browser environment.

## Installation

```bash
yarn add @mobile-dev-mcp/react
```

## Quick Start

### 1. Add the Provider

Wrap your app with `MCPProvider`:

```tsx
import { MCPProvider, MCPStatusBadge } from '@mobile-dev-mcp/react';

function App() {
  return (
    <MCPProvider debug={true}>
      <MyApp />
      <MCPStatusBadge />  {/* Optional status indicator */}
    </MCPProvider>
  );
}
```

### 2. Expose State

Use the `useMCPState` hook to make state visible to AI:

```tsx
import { useMCPState, useMCPStates } from '@mobile-dev-mcp/react';

function ShoppingCart() {
  const [items, setItems] = useState([]);
  const [user, setUser] = useState(null);

  // Single state exposure
  useMCPState('cartItems', () => items);
  useMCPState('user', () => user);

  // Or expose multiple states at once
  useMCPStates({
    cartItems: () => items,
    user: () => user,
    cartTotal: () => items.reduce((sum, i) => sum + i.price, 0),
    isLoggedIn: () => !!user,
  });

  return <div>...</div>;
}
```

### 3. Register Actions

Use the `useMCPAction` hook to let AI trigger functions:

```tsx
import { useMCPAction, useMCPActions } from '@mobile-dev-mcp/react';

function CartPage() {
  useMCPAction('addToCart', async (params) => {
    const product = await fetchProduct(params.productId);
    setCart(prev => [...prev, product]);
    return { success: true, product };
  });

  // Or register multiple actions at once
  useMCPActions({
    addToCart: async (params) => { /* ... */ },
    removeFromCart: (params) => { /* ... */ },
    clearCart: () => { /* ... */ },
  });

  return <div>...</div>;
}
```

## Hooks Reference

### State Hooks

#### `useMCPState(key, getter)`

Exposes a single state value:

```tsx
useMCPState('cart', () => cartItems);
```

#### `useMCPStates(states)`

Exposes multiple state values:

```tsx
useMCPStates({
  user: () => user,
  cart: () => cart,
  isLoggedIn: () => !!user,
});
```

### Action Hooks

#### `useMCPAction(name, handler)`

Registers a single action:

```tsx
useMCPAction('login', async (params) => {
  const user = await login(params.email, params.password);
  return { success: true, user };
});
```

#### `useMCPActions(actions)`

Registers multiple actions:

```tsx
useMCPActions({
  login: async (params) => { /* ... */ },
  logout: () => { /* ... */ },
});
```

### Component Hooks

#### `useMCPComponent(testId, options)`

Registers a UI component for AI interaction:

```tsx
const ref = useMCPComponent('submit-btn', {
  type: 'Button',
  props: { variant: 'primary' },
  getText: () => 'Submit Order',
  onTap: () => handleSubmit(),
});

return <button ref={ref}>Submit Order</button>;
```

#### `useMCPButton(testId, onClick, text)`

Shorthand for button registration:

```tsx
const ref = useMCPButton('checkout-btn', handleCheckout, 'Checkout');
return <button ref={ref}>Checkout</button>;
```

#### `useMCPText(testId, getText)`

Shorthand for text element registration:

```tsx
const ref = useMCPText('total-price', () => `$${total.toFixed(2)}`);
return <span ref={ref}>${total.toFixed(2)}</span>;
```

### Navigation Hooks

#### `useMCPNavigation(route, params)`

Tracks navigation state manually:

```tsx
import { useLocation, useParams } from 'react-router-dom';

function App() {
  const location = useLocation();
  const params = useParams();
  
  useMCPNavigation(location.pathname, params);
  
  return <Routes>...</Routes>;
}
```

#### `useMCPAutoNavigation()`

Automatically tracks browser location:

```tsx
function App() {
  useMCPAutoNavigation();
  return <div>...</div>;
}
```

### Tracing Hooks

#### `useMCPTrace()`

Returns functions for manual tracing:

```tsx
const { traceAsync, traceSync } = useMCPTrace();

const fetchData = async () => {
  return traceAsync('api.fetchData', async () => {
    const response = await fetch('/api/data');
    return response.json();
  }, { args: { endpoint: '/api/data' } });
};
```

#### `useMCPTraceRender(componentName)`

Traces component renders:

```tsx
function ExpensiveComponent() {
  useMCPTraceRender('ExpensiveComponent');
  // ...
}
```

### Connection Hooks

#### `useMCPConnection()`

Monitors connection status:

```tsx
const { isConnected, reconnect, disconnect } = useMCPConnection();

return (
  <div>
    Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
    {!isConnected && <button onClick={reconnect}>Reconnect</button>}
  </div>
);
```

## DOM Integration

The SDK automatically discovers elements with `data-testid` attributes:

```tsx
<button data-testid="add-to-cart-btn">Add to Cart</button>
<span data-testid="cart-total">${total}</span>
<input data-testid="search-input" />
```

AI can use these test IDs with:
- `find_element` - Find elements by testId
- `get_element_text` - Get text content
- `simulate_interaction` - Click, type, etc.

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

For Vite projects:

```typescript
// vite.config.ts
import react from '@vitejs/plugin-react';

export default {
  plugins: [
    react({
      babel: {
        plugins: [
          ['@mobile-dev-mcp/babel-plugin', { traceClasses: true }]
        ]
      }
    })
  ]
};
```

## Feature Flags

Register and toggle feature flags:

```tsx
import { MCPBridge } from '@mobile-dev-mcp/react';

// Register flags at startup
MCPBridge.registerFeatureFlags({
  darkMode: true,
  newCheckout: false,
  experimentalFeatures: false,
});

// Use flags in components
function App() {
  const darkMode = MCPBridge.getFeatureFlag('darkMode');
  return <div className={darkMode ? 'dark' : 'light'}>...</div>;
}

// AI can toggle flags via toggle_feature_flag tool
```

## Network Monitoring

The SDK automatically intercepts `fetch` calls:

```tsx
// All fetch calls are automatically tracked
await fetch('/api/users');
await fetch('/api/products', { method: 'POST', body: data });

// AI can see requests via get_network_requests tool
// AI can create mocks via mock_network_request tool
```

## Provider Options

```tsx
<MCPProvider
  serverUrl="ws://localhost:8765"  // WebSocket server URL
  debug={true}                      // Enable debug logging
  autoConnect={true}                // Connect automatically
  onConnected={() => {}}            // Connection callback
  onDisconnected={() => {}}         // Disconnection callback
  onError={(error) => {}}           // Error callback
>
  <App />
</MCPProvider>
```

## Security

- **Development Only**: SDK is disabled in production (`process.env.NODE_ENV === 'production'`)
- **Local Only**: All communication via localhost WebSocket
- **No Data Collection**: No external telemetry or data transmission
- **Safe Tree Shaking**: Production builds exclude all SDK code

## MCP Tools for Web

When connected, AI can use these tools:

| Tool | Description |
|------|-------------|
| `get_app_state` | Read exposed state values |
| `list_actions` | List registered actions |
| `execute_action` | Trigger registered actions |
| `get_component_tree` | Get UI component hierarchy |
| `find_element` | Find elements by testId |
| `get_element_text` | Get text content |
| `simulate_interaction` | Click, type, scroll |
| `capture_screenshot` | Capture viewport with visible elements |
| `get_traces` | View function traces |
| `get_active_traces` | View in-progress traces |
| `get_logs` | View console logs |
| `get_recent_errors` | View error logs |
| `list_feature_flags` | List feature flags |
| `toggle_feature_flag` | Toggle flag values |
| `list_network_requests` | View API requests |
| `mock_network_request` | Create network mocks |

## Troubleshooting

### Connection Issues

1. Ensure MCP server is running (`yarn dev` from monorepo root)
2. Check if port 8765 is available
3. Verify browser WebSocket support
4. Check console for connection errors

### State Not Visible

1. Verify `useMCPState` is called inside component
2. Check getter function returns current value
3. Ensure `MCPProvider` wraps the component

### Actions Not Working

1. Verify action name matches exactly
2. Check handler function returns a value
3. Look for errors in browser console

### Elements Not Found

1. Add `data-testid` attributes to elements
2. Use `useMCPComponent` for dynamic elements
3. Check element is rendered and visible

## Example Projects

See the demo app at `examples/react-web-demo` for a complete integration example.

```bash
cd examples/react-web-demo
yarn install
yarn dev
```
