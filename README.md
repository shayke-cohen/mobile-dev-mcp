# Mobile Dev MCP

> 🚀 AI-Assisted Mobile Development for Cursor IDE

A universal Model Context Protocol (MCP) server that connects **Cursor IDE** to live mobile applications via SDK integration, enabling AI-assisted development through bidirectional real-time communication.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## ✨ Features

- **🔍 State Inspection** - View and query app state (Redux, Zustand, ViewModels) in real-time
- **🌐 Network Monitoring** - Capture, inspect, mock, and replay network requests
- **📸 Screenshot Capture** - Take screenshots for visual debugging and regression testing
- **📝 Log Streaming** - Real-time console logs and error capture
- **🔧 Feature Flags** - Toggle feature flags without rebuilding
- **🔄 Bidirectional Communication** - Push events from app to Cursor

## 📦 Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@mobile-dev-mcp/server` | MCP Server for Cursor | 🚧 In Progress |
| `@mobile-dev-mcp/react-native` | React Native SDK | 🚧 In Progress |
| `sdk-ios` (Swift Package) | iOS/SwiftUI SDK | 🚧 In Progress |
| `sdk-android` (Gradle) | Android/Kotlin SDK | 🚧 In Progress |

## 🚀 Quick Start

### 1. Configure Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mobile-dev-mcp": {
      "command": "npx",
      "args": ["-y", "@mobile-dev-mcp/server@latest"]
    }
  }
}
```

### 2. Install SDK

#### React Native

```bash
npm install @mobile-dev-mcp/react-native
```

```typescript
// App.tsx
import { MCPBridge } from '@mobile-dev-mcp/react-native';

if (__DEV__) {
  MCPBridge.initialize();
  MCPBridge.exposeState('store', () => store.getState());
  MCPBridge.enableNetworkInterception();
}
```

#### iOS (Swift)

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/mobile-dev-mcp/sdk-ios.git", from: "1.0.0")
]

// App.swift
#if DEBUG
import MobileDevMCP

@main
struct MyApp: App {
    init() {
        MCPBridge.shared.initialize()
        MCPBridge.shared.exposeState(key: "user") { UserViewModel.shared.currentUser }
    }
}
#endif
```

#### Android (Kotlin)

```kotlin
// build.gradle.kts
dependencies {
    debugImplementation("com.mobiledevmcp:sdk-android:1.0.0")
}

// MainApplication.kt
if (BuildConfig.DEBUG) {
    MCPBridge.initialize(context = this)
    MCPBridge.exposeState("user") { UserViewModel.currentUser.value }
}
```

### 3. Start Debugging!

Run your app, then ask Cursor:

> "Why is the user profile not loading?"

The AI will:
1. Check app state via `get_app_state`
2. Inspect network requests via `list_network_requests`  
3. Review logs via `get_logs`
4. Suggest and apply fixes

## 🛠️ Available MCP Tools

| Tool | Description |
|------|-------------|
| `get_app_state` | Get current app state |
| `query_storage` | Query AsyncStorage/UserDefaults |
| `get_navigation_state` | Get navigation stack |
| `list_network_requests` | List captured network requests |
| `mock_network_request` | Mock API responses |
| `capture_screenshot` | Take screenshot |
| `get_component_tree` | Inspect UI hierarchy |
| `get_logs` | Get console logs |
| `get_recent_errors` | Get recent errors with context |
| `list_feature_flags` | Get feature flags |
| `toggle_feature_flag` | Toggle feature flag |
| `get_device_info` | Get device details |

## 📐 Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Cursor    │ ←──────→│ MCP Server  │ ←──────→│  Mobile App │
│   (AI IDE)  │  stdio  │  (Node.js)  │ WebSocket│  (w/ SDK)   │
└─────────────┘         └─────────────┘         └─────────────┘
```

See [SPECIFICATION.md](./SPECIFICATION.md) for detailed architecture.

## 🔒 Security

- **Development only** - SDK is completely removed from production builds
- **Localhost only** - Connections restricted to 127.0.0.1
- **No production overhead** - Zero impact on release builds

## 📁 Project Structure

```
mobile-dev-mcp/
├── packages/
│   ├── mcp-server/           # Node.js MCP server
│   ├── sdk-react-native/     # React Native SDK
│   ├── sdk-ios/              # Swift/iOS SDK
│   └── sdk-android/          # Kotlin/Android SDK
├── examples/
│   ├── react-native-demo/    # Sample RN app
│   ├── ios-swiftui-demo/     # Sample iOS app
│   └── android-compose-demo/ # Sample Android app
└── docs/
```

## 🛣️ Roadmap

- [x] Architecture design
- [x] MCP Server core (built & ready)
- [x] React Native SDK (source complete)
- [x] iOS Swift SDK (source complete)
- [x] Android Kotlin SDK (source complete)
- [x] Sample applications (source complete - see SETUP.md in each)
- [x] Documentation (SPECIFICATION.md, getting-started.md)
- [ ] Babel plugin for auto-instrumentation
- [ ] Flutter SDK
- [ ] Documentation site
- [ ] npm/Swift Package/Maven publishing

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## 📄 License

MIT © Mobile Dev MCP

---

Built with ❤️ for mobile developers who love AI-assisted development.
