# Mobile Dev MCP

> AI-assisted mobile and web development with Cursor IDE using the Model Context Protocol (MCP).

## Project Overview

This monorepo provides an MCP server and SDKs that enable AI assistants in Cursor to understand and interact with mobile and web applications in real-time. It supports **React Native**, **iOS**, **Android**, **macOS**, and **React Web** platforms.

## Key Capabilities

- **State Inspection** - AI can read app state (user, cart, settings, etc.)
- **Remote Actions** - AI can trigger actions (navigate, add to cart, login, etc.)
- **UI Inspection** - AI can see component tree and find elements by testId
- **Network Monitoring** - AI can see API requests and create mocks
- **Navigation Tracking** - AI knows current screen and navigation history
- **Feature Flags** - AI can toggle features for testing
- **Function Tracing** - AI can trace function calls for debugging
- **Screenshots** - AI can capture simulator/emulator screenshots

## Repository Structure

```
mobile-dev-mcp/
├── packages/
│   ├── mcp-server/              # MCP server for Cursor (Node.js/TypeScript)
│   ├── sdk-react-native/        # React Native SDK
│   ├── sdk-react/               # React Web SDK  
│   ├── sdk-ios/                 # iOS/macOS SDK (Swift)
│   ├── sdk-android/             # Android SDK (Kotlin)
│   ├── babel-plugin-mcp/        # Auto-instrumentation Babel plugin
│   └── mcp-android-gradle-plugin/ # Android auto-instrumentation
├── examples/
│   ├── react-native-demo/       # React Native e-commerce demo
│   ├── react-web-demo/          # React Web e-commerce demo
│   ├── ios-swiftui-demo/        # iOS SwiftUI demo
│   ├── android-compose-demo/    # Android Compose demo
│   └── macos-swiftui-demo/      # macOS SwiftUI demo
├── scripts/                     # Build and test scripts
└── docs/                        # Documentation
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| MCP Server | Node.js, TypeScript, WebSocket |
| React Native SDK | TypeScript, React Native |
| React Web SDK | TypeScript, React |
| iOS/macOS SDK | Swift, SwiftUI |
| Android SDK | Kotlin, Jetpack Compose |
| Build System | Turborepo, Yarn Workspaces |
| Testing | Vitest, Playwright (web e2e) |

## Commands

```bash
# Install dependencies
yarn install

# Build all packages
yarn build

# Start MCP server in dev mode
yarn dev

# Run all tests
yarn test

# Run E2E tests
yarn test:e2e              # All platforms
yarn test:e2e:ios          # iOS only
yarn test:e2e:android      # Android only
yarn test:e2e:rn           # React Native (iOS)
yarn test:e2e:rn-android   # React Native (Android)
yarn test:e2e:macos        # macOS only
yarn test:e2e:web          # React Web only (uses Playwright)

# Lint and format
yarn lint
yarn typecheck
```

## Package Details

### @mobile-dev-mcp/server

The MCP server that Cursor connects to. Provides 40+ tools for device management, app inspection, UI interaction, and debugging.

**Key files:**
- `src/index.ts` - Server entry point
- `src/tools/` - MCP tool implementations
- `src/connection/device-manager.ts` - WebSocket device management

### @mobile-dev-mcp/react-native

React Native SDK for exposing app state and registering actions.

**Key files:**
- `src/MCPBridge.ts` - Main bridge class
- `src/hooks/` - React hooks (useMCPState, useMCPAction, etc.)

### @mobile-dev-mcp/react

React Web SDK with hooks and providers for web applications.

**Key files:**
- `src/MCPBridge.ts` - Web-specific bridge implementation
- `src/providers/MCPProvider.tsx` - React context provider
- `src/hooks/` - React hooks for state, actions, tracing

### @mobile-dev-mcp/babel-plugin

Babel plugin for automatic function tracing in React Native and React Web apps.

**Configuration:**
```javascript
// babel.config.js
module.exports = {
  plugins: [
    ['@mobile-dev-mcp/babel-plugin', { 
      traceClasses: true,
      traceAsync: true,
      minLines: 3
    }]
  ]
};
```

### sdk-ios / sdk-android

Native SDKs for iOS/macOS (Swift) and Android (Kotlin).

**iOS Key files:**
- `Sources/MobileDevMCP/MCPBridge.swift`

**Android Key files:**
- `src/main/kotlin/com/mobiledevmcp/MCPBridge.kt`

## MCP Tools Reference

### Device Management
- `list_simulators` - List iOS simulators and Android emulators
- `boot_simulator` - Start a simulator/emulator
- `list_connected_devices` - List apps connected via SDK

### App Inspection
- `get_app_state` - Get app state values (supports dot notation paths)
- `get_device_info` - Get device information
- `get_logs` - Get console logs
- `get_recent_errors` - Get recent error logs

### UI Inspection
- `get_component_tree` - Get UI hierarchy with testIds
- `find_element` - Find elements by testId/type/text
- `get_element_text` - Get text content by testId
- `simulate_interaction` - Tap/input by testId

### Actions
- `list_actions` - List registered action handlers
- `execute_action` - Run any registered action
- `navigate_to` - Navigate to a route
- `add_to_cart` / `remove_from_cart` - Cart actions
- `login` / `logout` - Auth actions

### Feature Flags
- `list_feature_flags` - List all feature flags
- `toggle_feature_flag` - Toggle a flag value

### Network
- `list_network_requests` - List captured API requests
- `mock_network_request` - Create a network mock
- `clear_network_mocks` - Clear active mocks

### Tracing
- `get_traces` - Get function trace history
- `get_active_traces` - Get in-progress traces
- `clear_traces` - Clear trace history

### Screenshots
- `simulator_screenshot` - Capture iOS/macOS screenshot
- `emulator_screenshot` - Capture Android screenshot
- `capture_screenshot` - Capture web viewport (web platform)

## Development Workflow

### Adding a New MCP Tool

1. Define tool schema in `packages/mcp-server/src/tools/`
2. Implement handler function
3. Register in `packages/mcp-server/src/tools/index.ts`
4. Add SDK support if it requires device communication
5. Add E2E test in `scripts/e2e-test.js`

### Adding SDK Features

1. **React Native/Web**: Update `MCPBridge.ts` and add hooks if needed
2. **iOS/macOS**: Update `MCPBridge.swift`
3. **Android**: Update `MCPBridge.kt`

### Running Demo Apps

```bash
# React Native (iOS)
cd examples/react-native-demo && yarn ios

# React Native (Android)
cd examples/react-native-demo && yarn android

# React Web
cd examples/react-web-demo && yarn dev

# iOS SwiftUI
cd examples/ios-swiftui-demo && swift run

# Android Compose
cd examples/android-compose-demo && ./gradlew installDebug

# macOS SwiftUI
cd examples/macos-swiftui-demo && swift run
```

## Testing Strategy

- **Unit Tests**: Vitest for TypeScript packages
- **E2E Tests**: Custom test runner (`scripts/e2e-test.js`)
  - iOS: Uses xcrun simctl for simulator control
  - Android: Uses adb for emulator control
  - Web: Uses Playwright for real browser testing
  - Tests all MCP tools against real apps

## Important Conventions

- **Debug Only**: All SDK code is wrapped in `__DEV__` (RN), `#if DEBUG` (Swift), or `BuildConfig.DEBUG` (Android)
- **WebSocket Port**: Default is 8765
- **Package Manager**: Use yarn (specified in `packageManager` field)
- **Commit Style**: Follow Conventional Commits (feat:, fix:, docs:, etc.)

## Security Notes

- SDK only active in debug/development builds
- No telemetry or external data collection
- All communication via localhost WebSocket
- SDK code completely excluded from release builds

## Links

- [README](./README.md) - Full documentation
- [Getting Started](./docs/getting-started.md) - Setup guide
- [Contributing](./CONTRIBUTING.md) - Contribution guidelines
- [Changelog](./CHANGELOG.md) - Version history
