# Mobile Dev MCP

> **AI-Assisted Mobile Development for Cursor IDE**

A powerful [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server and SDK suite that enables AI-assisted debugging, inspection, and control of mobile applications directly from Cursor.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/github-mobile--dev--mcp-black)](https://github.com/shayke-cohen/mobile-dev-mcp)

## 🌟 Features

### 🔍 **State & Data Inspection**
- Real-time app state inspection (Redux, Zustand, SwiftUI, Jetpack Compose)
- Query AsyncStorage, UserDefaults, SharedPreferences
- Navigate and inspect any exposed state path
- Feature flag management

### 🌐 **Network Monitoring & Mocking**
- Capture all HTTP requests and responses
- Mock API responses for testing
- Replay failed requests
- Filter by URL, method, status code

### 📱 **UI Inspection & Automation**
- Capture screenshots from running apps
- Get complete view hierarchy
- Simulate taps, swipes, long-press
- Find elements by testID
- Programmatic navigation

### 📊 **Logging & Tracing**
- Capture console logs in real-time
- Track errors and crashes
- Function call tracing
- Performance timing

### 🎮 **Simulator/Emulator Control** (NEW!)
- List, boot, shutdown iOS Simulators and Android Emulators
- Install and launch apps
- Take screenshots and record video
- Send push notifications (iOS)
- Set GPS location
- Open deep links

### ⚡ **Auto-Instrumentation** (NEW!)
- Babel plugin for automatic function tracing
- Zero-config setup for React Native
- Development-only (stripped in production)

## 🚀 Quick Start

### 1. Install the MCP Server

```bash
git clone https://github.com/shayke-cohen/mobile-dev-mcp.git
cd mobile-dev-mcp
pnpm install
pnpm build
```

### 2. Configure Cursor

Add to your Cursor MCP settings (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "mobile-dev": {
      "command": "node",
      "args": ["/path/to/mobile-dev-mcp/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### 3. Add SDK to Your App

**React Native:**
```bash
npm install @mobile-dev-mcp/react-native
```

```typescript
// App.tsx
import { MCPBridge } from '@mobile-dev-mcp/react-native';

// Initialize in development
if (__DEV__) {
  MCPBridge.initialize({
    serverUrl: 'ws://localhost:8765',
    appName: 'MyApp',
  });
  
  // Enable features
  MCPBridge.enableNetworkInterception();
  MCPBridge.enableLogCapture();
  
  // Expose your app state
  MCPBridge.connectStore(store); // Redux/Zustand store
}
```

**iOS (Swift):**
```swift
// AppDelegate.swift
import MobileDevMCP

#if DEBUG
MCPBridge.shared.initialize(serverUrl: "ws://localhost:8765", appName: "MyApp")
MCPBridge.shared.enableNetworkInterception()
MCPBridge.shared.enableLogCapture()
#endif
```

**Android (Kotlin):**
```kotlin
// Application.kt
import com.mobiledevmcp.MCPBridge

if (BuildConfig.DEBUG) {
    MCPBridge.initialize(this, "ws://localhost:8765", "MyApp")
    MCPBridge.enableNetworkInterception()
    MCPBridge.enableLogCapture()
}
```

### 4. Start Using with Cursor!

Once configured, you can ask Cursor things like:

- *"Show me the current app state"*
- *"What network requests have been made?"*
- *"Take a screenshot of the app"*
- *"Mock the /api/users endpoint to return an error"*
- *"Boot the iPhone 15 simulator"*
- *"Set the simulator location to San Francisco"*

## 📦 Packages

| Package | Description |
|---------|-------------|
| `@mobile-dev-mcp/server` | MCP server with 35+ tools |
| `@mobile-dev-mcp/react-native` | React Native SDK with native modules |
| `@mobile-dev-mcp/babel-plugin` | Auto-instrumentation for tracing |
| `packages/sdk-ios` | iOS/Swift SDK (Swift Package) |
| `packages/sdk-android` | Android/Kotlin SDK |

## 🛠 Available Tools

### App Inspection (requires SDK connection)

| Tool | Description |
|------|-------------|
| `get_app_state` | Get current app state |
| `query_storage` | Query AsyncStorage/UserDefaults/SharedPrefs |
| `get_navigation_state` | Get current navigation stack |
| `list_feature_flags` | List registered feature flags |
| `toggle_feature_flag` | Toggle a feature flag |

### Network

| Tool | Description |
|------|-------------|
| `list_network_requests` | List captured HTTP requests |
| `mock_network_request` | Mock API responses |
| `clear_network_mocks` | Remove mocks |
| `replay_network_request` | Replay a request |

### UI & Interaction

| Tool | Description |
|------|-------------|
| `capture_screenshot` | Screenshot the app |
| `get_layout_tree` | Get view hierarchy |
| `simulate_interaction` | Tap, swipe, type |
| `navigate_to` | Navigate to a route |
| `find_element_by_test_id` | Find element by testID |

### Logging

| Tool | Description |
|------|-------------|
| `get_logs` | Get captured logs |
| `get_recent_errors` | Get recent errors |
| `get_function_trace` | Get function call traces |

### Simulator Control (no SDK required)

| Tool | Description |
|------|-------------|
| `list_simulators` | List iOS Simulators & Android Emulators |
| `boot_simulator` | Boot a simulator/emulator |
| `shutdown_simulator` | Shutdown simulator/emulator |
| `install_app` | Install .app or .apk |
| `launch_app` | Launch an app by bundle ID |
| `terminate_app` | Terminate a running app |
| `uninstall_app` | Uninstall an app |
| `simulator_screenshot` | Take simulator screenshot |
| `simulator_record` | Record video |
| `open_url` | Open URL/deep link |
| `push_notification` | Send push notification (iOS) |
| `set_location` | Set GPS location |
| `get_app_container` | Get app data path |
| `clear_app_data` | Clear app data (Android) |
| `get_device_logs` | Get system logs |

### Build & Run (no SDK required)

| Tool | Description |
|------|-------------|
| `build_app` | Build iOS, Android, or React Native app |
| `run_app` | Build and run app on simulator |
| `run_demo_app` | Run one of the MCP demo apps |
| `get_build_status` | Check status of a running build |
| `clean_build` | Clean build artifacts |

## 🔌 Auto-Instrumentation

Add automatic function tracing with our Babel plugin:

```javascript
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['@mobile-dev-mcp/babel-plugin', {
      traceClasses: true,
      traceAsync: true,
      minLines: 3,
    }],
  ],
};
```

This automatically instruments your functions:

```typescript
// Before
export async function fetchUser(id: string) {
  const response = await api.get(`/users/${id}`);
  return response.data;
}

// After (in __DEV__ only)
export async function fetchUser(id: string) {
  if (__DEV__) MCPBridge.trace('fetchUser', { args: { id } });
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } finally {
    if (__DEV__) MCPBridge.traceReturn('fetchUser');
  }
}
```

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Cursor IDE                            │
│                    (MCP Client)                              │
└─────────────────────────┬───────────────────────────────────┘
                          │ stdio (JSON-RPC)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Device Tools │  │  Sim Tools   │  │   Helpers    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│           │                │                                 │
│           ▼                ▼                                 │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │   Device     │  │  xcrun/adb   │                         │
│  │   Manager    │  │  commands    │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────┬───────────────────────────────────┘
                          │ WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Mobile App + SDK                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    State     │  │   Network    │  │     UI       │       │
│  │   Adapter    │  │   Adapter    │  │   Adapter    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Security

- **Development Only**: All SDK functionality is wrapped in `__DEV__` / `DEBUG` checks
- **No Production Impact**: SDKs are completely disabled in release builds
- **Local Only**: WebSocket server binds to localhost by default
- **No Data Storage**: No persistent storage of sensitive data

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run MCP server tests
pnpm --filter @mobile-dev-mcp/server test

# Run SDK tests
pnpm --filter @mobile-dev-mcp/react-native test
```

## 📚 Documentation

- [Getting Started Guide](./docs/getting-started.md)
- [Full Specification](./SPECIFICATION.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Babel Plugin README](./packages/babel-plugin-mcp/README.md)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) first.

```bash
# Setup development environment
git clone https://github.com/shayke-cohen/mobile-dev-mcp.git
cd mobile-dev-mcp
pnpm install
pnpm build

# Run in development mode
pnpm dev:server
```

## 📄 License

MIT © [Shay Cohen](https://github.com/shayke-cohen)

---

**Built with ❤️ for mobile developers who want AI-powered development**
