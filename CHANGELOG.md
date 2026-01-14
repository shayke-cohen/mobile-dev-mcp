# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-01-14

### Added

#### MCP Server
- Initial release of `@mobile-dev-mcp/server`
- WebSocket bridge for mobile app communication
- Device management tools (simulators/emulators)
- Screenshot capture for iOS and Android
- App state inspection
- Feature flag management
- Network request monitoring
- Log capture and error tracking

#### React Native SDK
- Initial release of `@mobile-dev-mcp/react-native`
- State exposure API (`exposeState`)
- Action registration API (`registerAction`, `registerActions`)
- Component registration for UI inspection (`registerComponent`)
- Navigation state tracking (`setNavigationState`)
- Network interception and mocking
- Log capture
- Feature flags support
- React hook for SDK state (`useMCPState`)

#### iOS SDK
- Initial release of `MobileDevMCP` Swift package
- State exposure API
- Action registration API
- Component registration for UI inspection
- Navigation state tracking
- UserDefaults query support
- Network mocking
- SwiftUI integration with `@ObservableObject`

#### Android SDK
- Initial release of `com.mobiledevmcp:sdk`
- State exposure API
- Action registration API (with coroutine support)
- Component registration for UI inspection
- Navigation state tracking
- SharedPreferences query support
- Network mocking
- Jetpack Compose integration with `StateFlow`

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

#### Validation Tools
- `get_navigation_state` - Get current route and history
- `query_storage` - Query AsyncStorage/UserDefaults/SharedPreferences
- `mock_network_request` - Create network mocks
- `clear_network_mocks` - Clear active mocks
- `replay_network_request` - Replay captured requests

#### Demo Apps
- React Native e-commerce demo app
- iOS SwiftUI e-commerce demo app
- Android Compose e-commerce demo app
- Full SDK integration examples
- Component registration examples

#### Testing
- Comprehensive E2E test suite
- 39 tests for iOS
- 40 tests for Android
- 39 tests for React Native
- UI automation tests with AppleScript (iOS) and ADB (Android)

### Security
- SDK only active in DEBUG/development builds
- No data collection or external communication
- All communication is local (WebSocket to localhost)

## [Unreleased]

### Planned
- Auto-instrumentation for common UI frameworks
- Performance monitoring
- Crash reporting integration
- Remote debugging tools
- Visual regression testing support
