# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-01-14

### Added

#### MCP Server (`@mobile-dev-mcp/server`)
- Initial release of MCP server for Cursor IDE
- WebSocket bridge for real-time mobile app communication
- 54 tools for device management, app inspection, and control
- Device management (iOS Simulator, Android Emulator)
- Screenshot capture for iOS, Android, and macOS
- App state inspection and manipulation
- Feature flag management with remote toggle
- Network request monitoring and mocking
- Log capture and error tracking
- Storage query (AsyncStorage, UserDefaults, SharedPreferences)

#### React Native SDK (`@mobile-dev-mcp/react-native`)
- State exposure API (`exposeState`)
- Action registration API (`registerAction`, `registerActions`)
- Component registration for UI inspection (`registerComponent`)
- Navigation state tracking (`setNavigationState`)
- **Function tracing** (`trace`, `traceReturn`, `traceAsync`, `traceSync`)
- Network interception and mocking
- Log capture
- Feature flags support
- React hook for SDK state (`useMCPState`)

#### iOS SDK (`MobileDevMCP`)
- Swift Package Manager and CocoaPods support
- State exposure API
- Action registration API
- Component registration for UI inspection
- Navigation state tracking
- **Function tracing** (`trace`, `traceReturn`, `traceAsync`, `traceSync`)
- UserDefaults query support
- Network mocking
- SwiftUI integration with `@ObservableObject`

#### macOS SDK (`MobileDevMCP`)
- **Full macOS support** using same SDK as iOS
- Native macOS SwiftUI integration
- Sidebar navigation pattern support
- All features from iOS SDK available on macOS
- macOS-specific device info (hostname, serial number)

#### Android SDK (`com.mobiledevmcp:sdk`)
- State exposure API
- Action registration API with coroutine support
- Component registration for UI inspection
- Navigation state tracking
- **Function tracing** (`trace`, `traceReturn`, `traceAsync`, `traceSync`)
- SharedPreferences query support
- Network mocking
- Jetpack Compose integration with `StateFlow`

#### Babel Plugin (`@mobile-dev-mcp/babel-plugin`)
- Auto-instrumentation for React Native functions
- Configurable function tracing
- File pattern matching for selective instrumentation

#### UI Inspection Tools
- `get_component_tree` - Get registered component hierarchy
- `get_layout_tree` - Get component bounds/positions
- `find_element` - Find elements by testId, type, or text
- `get_element_text` - Get text content by testId
- `simulate_interaction` - Tap/input by testId or coordinates
- `inspect_element` - Get element info at coordinates

#### Action Tools
- `list_actions` - List registered action handlers
- `execute_action` - Execute any registered action
- `navigate_to` - Navigate to a route
- `add_to_cart` / `remove_from_cart` / `clear_cart` - Cart actions
- `login` / `logout` - Authentication actions

#### Tracing Tools
- `get_traces` - Get function trace history with filtering
- `get_active_traces` - Get in-progress traces
- `clear_traces` - Clear trace history

#### Validation Tools
- `get_navigation_state` - Get current route and history
- `query_storage` - Query AsyncStorage/UserDefaults/SharedPreferences
- `mock_network_request` - Create network mocks
- `clear_network_mocks` - Clear active mocks
- `replay_network_request` - Replay captured requests

#### Demo Apps
- React Native e-commerce demo app
- iOS SwiftUI e-commerce demo app
- **macOS SwiftUI e-commerce demo app**
- Android Compose e-commerce demo app
- Full SDK integration examples
- Component registration examples

#### Testing
- Comprehensive E2E test suite
- 34 tests for iOS
- 34 tests for **macOS**
- 40 tests for Android
- 39 tests for React Native
- UI automation tests with AppleScript (iOS/macOS) and ADB (Android)

### Security
- SDK only active in DEBUG/development builds
- No data collection or external communication
- All communication is local (WebSocket to localhost)
- Production builds exclude SDK code entirely

## [Unreleased]

### Planned
- Visual regression testing support
- Performance monitoring dashboard
- Crash reporting integration
- Remote debugging tools
- VS Code extension support
- Web app SDK (React, Vue, Angular)
