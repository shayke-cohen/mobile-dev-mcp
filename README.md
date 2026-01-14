# Mobile Dev MCP

AI-assisted mobile and web development with Cursor IDE using the Model Context Protocol (MCP).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/@mobile-dev-mcp/server.svg)](https://www.npmjs.com/package/@mobile-dev-mcp/server)

## Overview

Mobile Dev MCP enables AI assistants in Cursor to understand and interact with your mobile app in real-time. It provides:

- 🔍 **State Inspection** - AI can see your app's state (user, cart, settings, etc.)
- 🎮 **Remote Actions** - AI can trigger actions (navigate, add to cart, login, etc.)
- 🌳 **UI Inspection** - AI can see your component tree and find elements by testId
- 📊 **Network Monitoring** - AI can see API requests and create mocks
- 🧭 **Navigation Tracking** - AI knows your current screen and navigation history
- 🚩 **Feature Flags** - AI can toggle features for testing
- 🔬 **Function Tracing** - AI can trace function calls for debugging

## Supported Platforms

| Platform | SDK | Status |
|----------|-----|--------|
| React Native | `@mobile-dev-mcp/react-native` | ✅ Production Ready |
| iOS (SwiftUI/UIKit) | `MobileDevMCP` | ✅ Production Ready |
| Android (Compose/Views) | `com.mobiledevmcp:sdk` | ✅ Production Ready |
| macOS (SwiftUI) | `MobileDevMCP` | ✅ Production Ready |
| React Web | `@mobile-dev-mcp/react` | ✅ Production Ready |

## Quick Start

### 1. Install the MCP Server

Add to your Cursor MCP settings (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "mobile-dev-mcp": {
      "command": "npx",
      "args": ["@mobile-dev-mcp/server"]
    }
  }
}
```

### 2. Install the SDK

**React Native:**
```bash
yarn add @mobile-dev-mcp/react-native
```

**React Web:**
```bash
yarn add @mobile-dev-mcp/react
```

**iOS / macOS (Swift Package Manager):**
```swift
.package(url: "https://github.com/mobile-dev-mcp/mobile-dev-mcp.git", from: "0.1.0")
```

**Android (Gradle):**
```kotlin
debugImplementation("com.mobiledevmcp:sdk:0.1.0")
```

### 3. Initialize in Your App

**React Native:**
```typescript
import { MCPBridge } from '@mobile-dev-mcp/react-native';

// In your App.tsx
useEffect(() => {
  if (__DEV__) {
    MCPBridge.initialize();
    
    // Expose state
    MCPBridge.exposeState('user', () => currentUser);
    MCPBridge.exposeState('cart', () => cartItems);
    
    // Register actions
    MCPBridge.registerAction('addToCart', (params) => {
      addToCart(params.productId);
      return { success: true };
    });
  }
}, []);
```

**React Web:**
```tsx
import { MCPProvider, useMCPState, useMCPAction } from '@mobile-dev-mcp/react';

function App() {
  return (
    <MCPProvider>
      <MyApp />
    </MCPProvider>
  );
}

function MyApp() {
  const [cart, setCart] = useState([]);
  
  // Expose state to AI
  useMCPState('cart', () => cart);
  
  // Register actions AI can trigger
  useMCPAction('addToCart', async (params) => {
    const product = await fetchProduct(params.productId);
    setCart(prev => [...prev, product]);
    return { success: true };
  });
  
  return <div>...</div>;
}
```

**iOS / macOS (Swift):**
```swift
#if DEBUG
MCPBridge.shared.initialize()
MCPBridge.shared.exposeState(key: "user") { currentUser }
MCPBridge.shared.registerAction(name: "addToCart") { params in
    addToCart(params["productId"] as! String)
    return ["success": true]
}
#endif
```

**Android (Kotlin):**
```kotlin
if (BuildConfig.DEBUG) {
    MCPBridge.initialize(this)
    MCPBridge.exposeState("user") { currentUser }
    MCPBridge.registerAction("addToCart") { params ->
        addToCart(params["productId"] as String)
        mapOf("success" to true)
    }
}
```

## Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   Cursor IDE    │◄──────────────────►│   MCP Server    │
│   (AI Agent)    │                    │  (Node.js)      │
└─────────────────┘                    └────────┬────────┘
                                                │
                                                │ WebSocket
                                                ▼
            ┌───────────────────────────────────────────────────────────────────┐
            │                    Native Apps & Web                               │
            ├─────────────┬─────────────┬─────────────┬─────────────┬───────────┤
            │ React Native│    iOS      │   Android   │   macOS     │ React Web │
            │    SDK      │    SDK      │     SDK     │    SDK      │    SDK    │
            └─────────────┴─────────────┴─────────────┴─────────────┴───────────┘
```

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [`@mobile-dev-mcp/server`](./packages/mcp-server) | MCP server for Cursor | `npx @mobile-dev-mcp/server` |
| [`@mobile-dev-mcp/react-native`](./packages/sdk-react-native) | React Native SDK | `yarn add @mobile-dev-mcp/react-native` |
| [`@mobile-dev-mcp/react`](./packages/sdk-react) | React Web SDK | `yarn add @mobile-dev-mcp/react` |
| [`MobileDevMCP`](./packages/sdk-ios) | iOS & macOS SDK (Swift) | Swift Package Manager |
| [`com.mobiledevmcp:sdk`](./packages/sdk-android) | Android SDK (Kotlin) | Maven Central |
| [`@mobile-dev-mcp/babel-plugin`](./packages/babel-plugin-mcp) | RN/Web Auto-instrumentation | `yarn add -D @mobile-dev-mcp/babel-plugin` |
| [`MCPAutoTrace`](./packages/sdk-ios) | iOS/macOS Auto-instrumentation | Swift Build Plugin |
| [`com.mobiledevmcp.autotrace`](./packages/mcp-android-gradle-plugin) | Android Auto-instrumentation | Gradle Plugin |

## Zero-Config Auto-Instrumentation

All platforms support **automatic function tracing** - no manual code changes needed:

### React Native & React Web (Babel Plugin)
```javascript
// babel.config.js
module.exports = {
  plugins: [
    ['@mobile-dev-mcp/babel-plugin', { traceClasses: true, traceAsync: true }]
  ]
};
```

### iOS / macOS (Swift Build Plugin)
```swift
// Package.swift
.target(
    name: "MyApp",
    dependencies: ["MobileDevMCP"],
    plugins: [.plugin(name: "MCPAutoTrace", package: "MobileDevMCP")]
)
```

### Android (Gradle Plugin)
```kotlin
// app/build.gradle.kts
plugins {
    id("com.mobiledevmcp.autotrace") version "1.0.0"
}
```

Once enabled, **all functions are automatically traced** during debug builds. Use `get_traces` to see execution flow, timing, and arguments - perfect for AI-assisted debugging.

## Demo Apps

The repository includes demo apps for each platform:

| Platform | Demo App | Description |
|----------|----------|-------------|
| React Native | [`examples/react-native-demo`](./examples/react-native-demo) | E-commerce app with full SDK integration |
| iOS | [`examples/ios-swiftui-demo`](./examples/ios-swiftui-demo) | SwiftUI e-commerce app |
| Android | [`examples/android-compose-demo`](./examples/android-compose-demo) | Jetpack Compose e-commerce app |
| macOS | [`examples/macos-swiftui-demo`](./examples/macos-swiftui-demo) | macOS SwiftUI e-commerce app |
| React Web | [`examples/react-web-demo`](./examples/react-web-demo) | React e-commerce web app |

## Available MCP Tools

### Device Management
| Tool | Description |
|------|-------------|
| `list_simulators` | List iOS simulators and Android emulators |
| `boot_simulator` | Start a simulator/emulator |
| `list_connected_devices` | List apps connected via SDK |

### App Inspection
| Tool | Description |
|------|-------------|
| `get_app_state` | Get app state values |
| `get_device_info` | Get device information |
| `get_logs` | Get console logs |
| `get_recent_errors` | Get recent error logs |

### UI Inspection
| Tool | Description |
|------|-------------|
| `get_component_tree` | Get UI hierarchy with testIds |
| `find_element` | Find elements by testId/type/text |
| `get_element_text` | Get text content by testId |
| `simulate_interaction` | Tap/input by testId |

### Actions
| Tool | Description |
|------|-------------|
| `list_actions` | List registered action handlers |
| `execute_action` | Run any registered action |
| `navigate_to` | Navigate to a route |
| `add_to_cart` / `remove_from_cart` | Cart actions |
| `login` / `logout` | Auth actions |

### Feature Flags
| Tool | Description |
|------|-------------|
| `list_feature_flags` | List all feature flags |
| `toggle_feature_flag` | Toggle a flag value |

### Network
| Tool | Description |
|------|-------------|
| `list_network_requests` | List captured API requests |
| `mock_network_request` | Create a network mock |
| `clear_network_mocks` | Clear active mocks |

### Tracing (New!)
| Tool | Description |
|------|-------------|
| `get_traces` | Get function trace history |
| `get_active_traces` | Get in-progress traces |
| `clear_traces` | Clear trace history |

### Screenshots
| Tool | Description |
|------|-------------|
| `simulator_screenshot` | Capture iOS/macOS screenshot |
| `emulator_screenshot` | Capture Android screenshot |
| `capture_screenshot` | Capture web viewport (web platform) |

## SDK Features

### State Exposure
```typescript
// Expose any state for AI inspection
MCPBridge.exposeState('cart', () => cartItems);
MCPBridge.exposeState('user', () => currentUser);
```

### Action Registration
```typescript
// Register actions AI can trigger
MCPBridge.registerAction('checkout', async (params) => {
  await processCheckout(params);
  return { success: true };
});
```

### UI Component Registration
```typescript
// Register components for AI to find/interact with
MCPBridge.registerComponent('submit-btn', {
  type: 'Button',
  onPress: () => submit(),
  getText: () => 'Submit Order'
});
```

### Function Tracing
```typescript
// Trace function execution for debugging
const result = await MCPBridge.traceAsync('fetchUser', async () => {
  return await api.getUser(userId);
}, { args: { userId } });

// Or use the Babel plugin for automatic instrumentation
```

### Navigation Tracking
```typescript
// Track current screen
MCPBridge.setNavigationState('products', { category: 'electronics' });
```

## Testing

```bash
# Run all E2E tests
yarn test:e2e

# Platform-specific tests
yarn test:e2e:ios       # iOS tests
yarn test:e2e:android   # Android tests
yarn test:e2e:rn        # React Native tests
yarn test:e2e:macos     # macOS tests
yarn test:e2e:web       # React Web tests
```

## Development

```bash
# Install dependencies
yarn install

# Start MCP server in dev mode
yarn dev

# Run demo apps
cd examples/react-native-demo && yarn ios
cd examples/ios-swiftui-demo && swift run
cd examples/android-compose-demo && ./gradlew installDebug
cd examples/macos-swiftui-demo && swift run
cd examples/react-web-demo && yarn dev
```

## Security

- 🔒 **Debug Only** - SDK only active in DEBUG/development builds
- 🚫 **No Data Collection** - No telemetry or external communication
- 🏠 **Local Only** - All communication via localhost WebSocket
- ✅ **Production Safe** - SDK code completely excluded from release builds

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT © Mobile Dev MCP

---

<p align="center">
  <b>Built for developers who want AI to truly understand their mobile apps.</b>
</p>
