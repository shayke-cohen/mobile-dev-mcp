# Mobile Dev MCP

AI-assisted mobile development with Cursor IDE using the Model Context Protocol (MCP).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Mobile Dev MCP enables AI assistants in Cursor to understand and interact with your mobile app in real-time. It provides:

- 🔍 **State Inspection** - AI can see your app's state (user, cart, settings, etc.)
- 🎮 **Remote Actions** - AI can trigger actions (navigate, add to cart, login, etc.)
- 🌳 **UI Inspection** - AI can see your component tree and find elements by testId
- 📊 **Network Monitoring** - AI can see API requests and create mocks
- 🧭 **Navigation Tracking** - AI knows your current screen and navigation history
- 🚩 **Feature Flags** - AI can toggle features for testing

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
npm install @mobile-dev-mcp/react-native
```

**iOS (Swift Package Manager):**
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

**iOS (Swift):**
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
                    ┌───────────────────────────────────────────┐
                    │              Mobile Apps                   │
                    ├─────────────┬─────────────┬───────────────┤
                    │ React Native│    iOS      │   Android     │
                    │    SDK      │    SDK      │     SDK       │
                    └─────────────┴─────────────┴───────────────┘
```

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@mobile-dev-mcp/server`](./packages/mcp-server) | MCP server for Cursor | [![npm](https://img.shields.io/npm/v/@mobile-dev-mcp/server)](https://www.npmjs.com/package/@mobile-dev-mcp/server) |
| [`@mobile-dev-mcp/react-native`](./packages/sdk-react-native) | React Native SDK | [![npm](https://img.shields.io/npm/v/@mobile-dev-mcp/react-native)](https://www.npmjs.com/package/@mobile-dev-mcp/react-native) |
| [`MobileDevMCP`](./packages/sdk-ios) | iOS SDK (Swift) | Swift Package Manager |
| [`com.mobiledevmcp:sdk`](./packages/sdk-android) | Android SDK (Kotlin) | Maven Central |

## Demo Apps

The repository includes demo apps for each platform:

- [`examples/react-native-demo`](./examples/react-native-demo) - React Native e-commerce app
- [`examples/ios-swiftui-demo`](./examples/ios-swiftui-demo) - iOS SwiftUI e-commerce app
- [`examples/android-compose-demo`](./examples/android-compose-demo) - Android Compose e-commerce app

## Testing

```bash
# Run all E2E tests
yarn test:e2e

# Platform-specific tests
yarn test:e2e:ios
yarn test:e2e:android
yarn test:e2e:rn
```

## Available MCP Tools

### Device Management
- `list_simulators` / `list_emulators` - List available devices
- `boot_simulator` / `boot_emulator` - Start a device
- `list_connected_devices` - List apps connected via SDK

### App Inspection
- `get_app_state` - Get app state values
- `get_device_info` - Get device information
- `get_logs` / `get_recent_errors` - Get console logs

### UI Inspection
- `get_component_tree` - Get UI hierarchy
- `find_element` - Find by testId/type/text
- `simulate_interaction` - Tap/input by testId

### Actions
- `list_actions` - List registered actions
- `execute_action` - Run an action
- `navigate_to` - Navigate to route

### Feature Flags
- `list_feature_flags` - List all flags
- `toggle_feature_flag` - Toggle a flag

### Network
- `list_network_requests` - List API requests
- `mock_network_request` - Create mock
- `clear_network_mocks` - Clear mocks

### Screenshots
- `simulator_screenshot` - iOS screenshot
- `emulator_screenshot` - Android screenshot

## Development

```bash
# Install dependencies
yarn install

# Start MCP server in dev mode
yarn dev:server

# Run demo apps
cd examples/react-native-demo && yarn ios
cd examples/ios-swiftui-demo && open MCPDemoApp.xcodeproj
cd examples/android-compose-demo && ./gradlew installDebug
```

## Contributing

Contributions are welcome! Please read our contributing guidelines first.

## License

MIT © Mobile Dev MCP
