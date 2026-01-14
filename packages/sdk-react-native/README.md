# @mobile-dev-mcp/react-native

React Native SDK for Mobile Dev MCP - enables AI-assisted development in Cursor IDE.

[![npm version](https://img.shields.io/npm/v/@mobile-dev-mcp/react-native.svg)](https://www.npmjs.com/package/@mobile-dev-mcp/react-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔍 **State Exposure** - Let AI see your app state
- 🎮 **Action Registration** - Let AI trigger app functions
- 🌳 **Component Registration** - Let AI find and interact with UI
- 🧭 **Navigation Tracking** - Let AI know current screen
- 🔬 **Function Tracing** - Debug function calls with AI
- 📊 **Network Monitoring** - Track API calls
- 🚩 **Feature Flags** - Toggle features for testing

## Installation

```bash
npm install @mobile-dev-mcp/react-native
# or
yarn add @mobile-dev-mcp/react-native
```

## Quick Start

```typescript
import { MCPBridge } from '@mobile-dev-mcp/react-native';

// Initialize in your app entry point (App.tsx)
useEffect(() => {
  if (__DEV__) {
    MCPBridge.initialize();
    MCPBridge.enableLogCapture();
    MCPBridge.enableNetworkInterception();
  }
}, []);
```

## Expose State

Let AI inspect your app state:

```typescript
// Expose state for AI inspection
MCPBridge.exposeState('user', () => currentUser);
MCPBridge.exposeState('cart', () => cartItems);
MCPBridge.exposeState('cartTotal', () => 
  cart.reduce((sum, item) => sum + item.price, 0)
);
MCPBridge.exposeState('isLoggedIn', () => !!currentUser);
```

## Register Actions

Let AI trigger actions in your app:

```typescript
MCPBridge.registerActions({
  // Navigation
  navigate: (params) => {
    navigation.navigate(params.route);
    return { navigatedTo: params.route };
  },

  // Cart actions
  addToCart: (params) => {
    addToCart(params.productId);
    return { added: params.productId };
  },

  removeFromCart: (params) => {
    removeFromCart(params.productId);
    return { removed: params.productId };
  },

  // Auth actions
  login: async (params) => {
    await login(params.username, params.password);
    return { loggedIn: true };
  },

  logout: () => {
    logout();
    return { loggedOut: true };
  },
});
```

## Register UI Components

Enable AI to find and interact with UI elements:

```typescript
// Register a button
MCPBridge.registerComponent('add-to-cart-btn', {
  type: 'Button',
  props: { productId: product.id },
  onPress: () => addToCart(product),
  getText: () => 'Add to Cart',
});

// Register a text element
MCPBridge.registerComponent('product-title', {
  type: 'Text',
  getText: () => product.name,
});

// Register with bounds for layout inspection
MCPBridge.registerComponent('hero-banner', {
  type: 'Image',
  bounds: { x: 0, y: 0, width: 375, height: 200 },
});
```

## Track Navigation

Let AI know your current screen:

```typescript
// In your navigation handler
useEffect(() => {
  MCPBridge.setNavigationState(currentScreen, { 
    category: selectedCategory 
  });
}, [currentScreen, selectedCategory]);
```

## Function Tracing

Debug function execution with AI assistance:

```typescript
// Trace async functions
const user = await MCPBridge.traceAsync('UserService.fetchUser', 
  async () => {
    return await api.getUser(userId);
  }, 
  { args: { userId }, file: 'UserService.ts' }
);

// Trace sync functions
const total = MCPBridge.traceSync('calculateTotal', () => {
  return items.reduce((sum, item) => sum + item.price, 0);
});

// Manual tracing
MCPBridge.trace('processOrder', { args: { orderId } });
// ... processing ...
MCPBridge.traceReturn('processOrder', { success: true });
```

### Auto-Instrumentation with Babel Plugin

For automatic function tracing, use the Babel plugin:

```bash
npm install -D @mobile-dev-mcp/babel-plugin
```

```javascript
// babel.config.js
module.exports = {
  plugins: [
    ['@mobile-dev-mcp/babel-plugin', {
      traceFunctions: true,
      include: ['src/services/**', 'src/api/**'],
    }]
  ]
};
```

## Feature Flags

```typescript
// Register flags
MCPBridge.registerFeatureFlags({
  darkMode: true,
  newCheckout: false,
  showRecommendations: true,
});

// Use flags in your app
const showNewCheckout = MCPBridge.getFeatureFlag('newCheckout');
```

## React Hook

```typescript
import { useState, useEffect } from 'react';
import { MCPBridge } from '@mobile-dev-mcp/react-native';

export function useMCPState() {
  const [state, setState] = useState(MCPBridge.getState());

  useEffect(() => {
    return MCPBridge.subscribe(setState);
  }, []);

  return state;
}

// Usage
function MCPStatusBadge() {
  const { isConnected, lastActivity } = useMCPState();
  
  return (
    <View style={styles.badge}>
      <View style={[
        styles.dot, 
        { backgroundColor: isConnected ? 'green' : 'red' }
      ]} />
      <Text>{isConnected ? 'Connected' : 'Disconnected'}</Text>
      <Text style={styles.activity}>{lastActivity}</Text>
    </View>
  );
}
```

## Configuration

```typescript
MCPBridge.initialize({
  // Custom server URL
  // Default: ws://localhost:8765 (iOS) or ws://10.0.2.2:8765 (Android)
  serverUrl: 'ws://192.168.1.100:8765',
  
  // Enable debug logging
  debug: true,
  
  // Reconnection interval in ms
  reconnectInterval: 3000,
});
```

## API Reference

### Core Methods

| Method | Description |
|--------|-------------|
| `initialize(config?)` | Initialize the SDK |
| `disconnect()` | Disconnect from server |
| `reconnect()` | Manually reconnect |
| `getState()` | Get current SDK state |
| `subscribe(callback)` | Subscribe to state changes |

### State Methods

| Method | Description |
|--------|-------------|
| `exposeState(key, getter)` | Expose state for AI |
| `removeState(key)` | Remove exposed state |

### Action Methods

| Method | Description |
|--------|-------------|
| `registerAction(name, handler)` | Register single action |
| `registerActions(actions)` | Register multiple actions |
| `getRegisteredActions()` | List registered actions |

### Component Methods

| Method | Description |
|--------|-------------|
| `registerComponent(testId, config)` | Register UI component |
| `unregisterComponent(testId)` | Remove component |
| `updateComponentBounds(testId, bounds)` | Update component bounds |

### Navigation Methods

| Method | Description |
|--------|-------------|
| `setNavigationState(route, params?)` | Set current route |

### Tracing Methods

| Method | Description |
|--------|-------------|
| `trace(name, info?)` | Start a trace |
| `traceReturn(name, value?, error?)` | Complete a trace |
| `traceAsync(name, fn, info?)` | Trace async function |
| `traceSync(name, fn, info?)` | Trace sync function |
| `getTraces(filter?)` | Get trace history |
| `clearTraces()` | Clear traces |

### Feature Flag Methods

| Method | Description |
|--------|-------------|
| `registerFeatureFlags(flags)` | Register flags |
| `getFeatureFlag(key)` | Get flag value |

### Capture Methods

| Method | Description |
|--------|-------------|
| `enableLogCapture()` | Enable console capture |
| `enableNetworkInterception()` | Enable network capture |

## Requirements

- React Native >= 0.72.0
- React >= 18.0.0

## Optional Dependencies

- `@react-native-async-storage/async-storage` - For storage query support

## Security

- SDK is only active when `__DEV__` is true
- All communication is local (WebSocket to localhost)
- No data is sent to external servers
- Safe to include in production builds (code is stripped)

## License

MIT
