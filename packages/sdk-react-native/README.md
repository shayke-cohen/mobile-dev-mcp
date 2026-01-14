# @mobile-dev-mcp/react-native

React Native SDK for Mobile Dev MCP - enables AI-assisted development in Cursor IDE.

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
MCPBridge.exposeState('cartTotal', () => cart.reduce((sum, item) => sum + item.price, 0));
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

  // Auth actions
  login: () => {
    login();
    return { loggedIn: true };
  },
});
```

## Register UI Components

Enable AI to find and interact with UI elements:

```typescript
MCPBridge.registerComponent('add-to-cart-btn', {
  type: 'Button',
  onPress: () => addToCart(product),
  getText: () => 'Add to Cart',
});

MCPBridge.registerComponent('product-title', {
  type: 'Text',
  getText: () => product.name,
});
```

## Track Navigation

Let AI know your current screen:

```typescript
useEffect(() => {
  MCPBridge.setNavigationState(currentScreen);
}, [currentScreen]);
```

## Feature Flags

```typescript
// Register flags
MCPBridge.registerFeatureFlags({
  darkMode: true,
  newCheckout: false,
});

// Use flags
const isDarkMode = MCPBridge.getFeatureFlag('darkMode');
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
function MyComponent() {
  const { isConnected, lastActivity } = useMCPState();
  
  return (
    <View>
      <Text>MCP: {isConnected ? 'Connected' : 'Disconnected'}</Text>
      <Text>{lastActivity}</Text>
    </View>
  );
}
```

## Configuration

```typescript
MCPBridge.initialize({
  // Custom server URL (default: ws://localhost:8765 for iOS, ws://10.0.2.2:8765 for Android)
  serverUrl: 'ws://192.168.1.100:8765',
  
  // Enable debug logging
  debug: true,
  
  // Reconnection interval in ms
  reconnectInterval: 3000,
});
```

## Requirements

- React Native >= 0.72.0
- React >= 18.0.0

## Optional Dependencies

- `@react-native-async-storage/async-storage` - For storage query support

## License

MIT
