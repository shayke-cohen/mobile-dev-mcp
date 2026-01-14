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
yarn install
yarn build
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
  // SDK auto-detects platform and uses appropriate host
  // Android emulator: ws://10.0.2.2:8765
  // iOS/real devices: ws://localhost:8765
  MCPBridge.initialize({ debug: true });
  
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
// SDK uses ws://localhost:8765 by default
MCPBridge.shared.initialize(debug: true)
MCPBridge.shared.enableNetworkInterception()
MCPBridge.shared.enableLogCapture()

// Or specify custom server
MCPBridge.shared.initialize(serverUrl: "ws://192.168.1.100:8765", debug: true)
#endif
```

**Android (Kotlin):**
```kotlin
// Application.kt
import com.mobiledevmcp.MCPBridge

if (BuildConfig.DEBUG) {
    // SDK auto-detects emulator vs real device
    // Emulator: ws://10.0.2.2:8765
    // Real device: ws://localhost:8765 (use adb reverse)
    MCPBridge.initialize(context = this, debug = true)
    MCPBridge.enableNetworkInterception()
    MCPBridge.enableLogCapture()
    
    // Or specify custom server
    MCPBridge.initialize(context = this, serverUrl = "ws://192.168.1.100:8765")
}
```

### 4. Start Using with Cursor!

Once configured, you can use slash commands or natural language:

```
/simulators                    - List available simulators
/boot iPhone 15 Pro            - Boot a simulator
/demo ios                      - Run the iOS demo app
/state                         - Show app state
/network                       - Show network requests
/screenshot                    - Take a screenshot
```

Or just ask naturally:
- *"Boot the iPhone 15 simulator and run the demo app"*
- *"What network requests is the app making?"*
- *"Mock the /api/users endpoint to return an error"*
- *"Set the simulator location to San Francisco"*

See [COMMANDS.md](./COMMANDS.md) for the full command reference.

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

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CURSOR IDE                                    │
│                         (MCP Client)                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  "What's in the user's cart?" → AI interprets → calls get_app_state │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  │ stdio (JSON-RPC 2.0)
                                  │ Bidirectional communication
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           MCP SERVER                                     │
│                    (Node.js + TypeScript)                                │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  Device Tools   │  │ Simulator Tools │  │   Build Tools   │         │
│  │  (24 tools)     │  │   (20 tools)    │  │                 │         │
│  │                 │  │                 │  │                 │         │
│  │ • get_app_state │  │ • list_sims     │  │ • build_app     │         │
│  │ • get_logs      │  │ • boot/shutdown │  │ • run_app       │         │
│  │ • feature_flags │  │ • screenshot    │  │ • run_demo_app  │         │
│  │ • network_reqs  │  │ • set_location  │  │ • clean_build   │         │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────┘         │
│           │                    │                                        │
│           ▼                    ▼                                        │
│  ┌─────────────────┐  ┌─────────────────┐                              │
│  │ Device Manager  │  │  Shell Commands │                              │
│  │                 │  │                 │                              │
│  │ • Manages WS    │  │ • xcrun simctl  │                              │
│  │   connections   │  │ • adb           │                              │
│  │ • Routes cmds   │  │ • xcodebuild    │                              │
│  │ • Tracks state  │  │ • gradlew       │                              │
│  └────────┬────────┘  └─────────────────┘                              │
│           │                                                             │
└───────────┼─────────────────────────────────────────────────────────────┘
            │
            │ WebSocket (ws://localhost:8765)
            │ Persistent connection, JSON messages
            │
    ┌───────┴───────┬───────────────┬───────────────┐
    │               │               │               │
    ▼               ▼               ▼               ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐
│  iOS App  │ │Android App│ │  RN App   │ │  Test Client  │
│  + SDK    │ │  + SDK    │ │  + SDK    │ │  (Optional)   │
└───────────┘ └───────────┘ └───────────┘ └───────────────┘
```

### Component Details

#### 1. Cursor IDE (MCP Client)

Cursor acts as the MCP client, communicating with the server via **stdio**:
- Sends tool calls as JSON-RPC 2.0 requests
- Receives results and displays them to the user
- AI interprets natural language and maps to appropriate tools

#### 2. MCP Server

The central hub that bridges Cursor and mobile apps:

| Component | Purpose |
|-----------|---------|
| **stdio Interface** | JSON-RPC communication with Cursor |
| **WebSocket Server** | Real-time connection with mobile SDKs (port 8765) |
| **Device Manager** | Tracks connected apps, routes commands, manages state |
| **Tool Registry** | 44 tools across device, simulator, and build categories |

#### 3. Mobile SDKs

Platform-specific SDKs that run inside your app:

| Platform | SDK Location | WebSocket URL |
|----------|--------------|---------------|
| **iOS** | `MCPBridge.swift` | `ws://localhost:8765` |
| **Android** | `MCPBridge.kt` | `ws://10.0.2.2:8765` (emulator) |
| **React Native** | `MCPBridge.ts` | `ws://localhost:8765` |

**SDK Capabilities:**
- **State Exposure**: Register getters for any app state
- **Log Capture**: Intercept console.log/NSLog/Log.d
- **Network Interception**: Capture HTTP requests/responses
- **Feature Flags**: Runtime flag management
- **Auto-Reconnect**: 3-second retry on disconnect

#### 4. Demo Apps

Three fully-functional demo apps showcasing SDK integration:

```
examples/
├── ios-swiftui-demo/       # SwiftUI e-commerce app
│   └── MCPDemoApp/
│       ├── MCP/MCPBridge.swift   # Inline SDK
│       └── ContentView.swift      # Status banner
│
├── android-compose-demo/   # Jetpack Compose e-commerce app
│   └── app/src/main/kotlin/
│       ├── mcp/MCPBridge.kt      # Inline SDK
│       └── ui/screens/           # Status card
│
└── react-native-demo/      # React Native e-commerce app
    └── src/
        ├── mcp/MCPBridge.ts      # Inline SDK
        └── App.tsx               # Status banner
```

### Communication Flow

#### Flow 1: App State Query

```
User: "What's in the cart?"
         │
         ▼
┌─────────────────┐
│   Cursor AI     │ Interprets query, decides to call get_app_state
└────────┬────────┘
         │ JSON-RPC: {"method": "tools/call", "params": {"name": "get_app_state"}}
         ▼
┌─────────────────┐
│   MCP Server    │ Receives request, looks up connected device
└────────┬────────┘
         │ WebSocket: {"id": "123", "method": "get_app_state", "params": {"key": "cart"}}
         ▼
┌─────────────────┐
│   Mobile SDK    │ Calls registered state getter, returns cart data
└────────┬────────┘
         │ WebSocket: {"type": "response", "id": "123", "result": {"items": [...]}}
         ▼
┌─────────────────┐
│   MCP Server    │ Forwards result to Cursor
└────────┬────────┘
         │ JSON-RPC: {"result": {"content": [{"type": "text", "text": "Cart: ..."}]}}
         ▼
┌─────────────────┐
│   Cursor AI     │ Formats and displays: "The cart has 3 items totaling $45.99"
└─────────────────┘
```

#### Flow 2: Simulator Control (No SDK Required)

```
User: "Take a screenshot of the simulator"
         │
         ▼
┌─────────────────┐
│   Cursor AI     │ Calls simulator_screenshot tool
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   MCP Server    │ Executes: xcrun simctl io booted screenshot
└────────┬────────┘
         │
         ▼
    [Screenshot saved to temp file, returned as base64]
```

### WebSocket Protocol

**Handshake (App → Server):**
```json
{
  "type": "handshake",
  "platform": "ios",
  "appName": "MyApp",
  "appVersion": "1.0.0",
  "deviceId": "unique-device-id",
  "capabilities": ["state", "logs", "network", "featureFlags"]
}
```

**Command (Server → App):**
```json
{
  "id": "cmd-123",
  "method": "get_app_state",
  "params": { "key": "cart" }
}
```

**Response (App → Server):**
```json
{
  "type": "response",
  "id": "cmd-123",
  "result": { "items": [], "total": 0 }
}
```

### Project Structure

```
mobile-dev-mcp/
├── packages/
│   ├── mcp-server/           # Main MCP server
│   │   ├── src/
│   │   │   ├── index.ts      # Entry point (stdio + WebSocket)
│   │   │   ├── tools/        # Tool implementations
│   │   │   │   ├── device.ts     # App inspection tools
│   │   │   │   ├── simulator.ts  # Simulator control
│   │   │   │   └── build.ts      # Build & run tools
│   │   │   └── device-manager.ts # WebSocket + device tracking
│   │   └── dist/             # Compiled JS (run this)
│   │
│   ├── sdk-react-native/     # React Native SDK package
│   ├── sdk-ios/              # iOS Swift SDK package
│   └── sdk-android/          # Android Kotlin SDK package
│
├── examples/
│   ├── ios-swiftui-demo/     # iOS demo with inline SDK
│   ├── android-compose-demo/ # Android demo with inline SDK
│   └── react-native-demo/    # React Native demo with inline SDK
│
├── scripts/
│   ├── e2e-test.js           # End-to-end test suite
│   ├── test-client.js        # Interactive test client
│   └── run-*-demo.sh         # Demo app runners
│
└── TESTING.md                # Testing documentation
```

## 🔄 SDK Features

### Automatic Reconnection

All SDKs include automatic reconnection with exponential backoff:
- **3-second retry interval** when server is unavailable
- **Automatic reconnect** on connection loss
- **Manual reconnect** button in demo apps

### Activity Logging & Status

SDKs expose real-time status for debugging:

```typescript
// React Native
MCPBridge.subscribe((state) => {
  console.log(state.isConnected);    // true/false
  console.log(state.lastActivity);    // "[12:30:45] Connected!"
  console.log(state.reconnectCount);  // Number of retry attempts
  console.log(state.activityLog);     // Last 50 activity entries
});

// Manual reconnect
MCPBridge.reconnect();
```

Demo apps include an **MCP Status Banner** showing:
- Connection status (green/red indicator)
- Reconnect attempts counter
- Last activity message
- "Reconnect" and "Activity Log" buttons

## 🔐 Security

- **Development Only**: All SDK functionality is wrapped in `__DEV__` / `DEBUG` checks
- **No Production Impact**: SDKs are completely disabled in release builds
- **Local Only**: WebSocket server binds to localhost by default
- **No Data Storage**: No persistent storage of sensitive data

## 🧪 Testing

```bash
# Run unit tests
yarn test

# Run E2E tests (iOS + Android)
yarn test:e2e

# Run E2E for specific platform
yarn test:e2e:ios
yarn test:e2e:android

# Interactive test client
node scripts/test-client.js
```

See [TESTING.md](./TESTING.md) for comprehensive testing documentation.

## 📚 Documentation

- [**Commands Reference**](./COMMANDS.md) - Quick command reference for Cursor
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
yarn install
yarn build

# Run in development mode
yarn dev:server
```

## 📄 License

MIT © [Shay Cohen](https://github.com/shayke-cohen)

---

**Built with ❤️ for mobile developers who want AI-powered development**
