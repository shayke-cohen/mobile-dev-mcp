# Android Compose MCP Demo App

A sample Android app demonstrating the Mobile Dev MCP SDK integration with Jetpack Compose.

## Features

- **Home Screen**: Welcome banner, quick actions, cart summary, debug info
- **Product List**: Browse products with add-to-cart functionality
- **Cart**: Manage cart items with quantity controls
- **Profile**: User authentication

## MCP SDK Integration

The app is prepared to integrate with the MCP SDK to expose:

- **User state**: Current user, login status
- **Cart state**: Items, total, count
- **Products state**: Available products
- **Feature flags**: Dark mode, new checkout, recommendations

## Setup

1. Open in Android Studio:
   ```bash
   cd examples/android-compose-demo
   studio .  # or open Android Studio and select this folder
   ```

2. Build and run on Android Emulator

3. Start the MCP server:
   ```bash
   cd packages/mcp-server
   npm run dev
   ```

4. For physical devices, enable port forwarding:
   ```bash
   adb reverse tcp:8765 tcp:8765
   ```

5. Open Cursor and try queries like:
   - "What's in the user's cart?"
   - "Show me the app state"
   - "Toggle the dark_mode feature flag"

## Architecture

- **MCPDemoApplication.kt**: App entry point with MCP initialization
- **MainActivity.kt**: Single activity hosting Compose UI
- **AppViewModel.kt**: Central state management with StateFlow
- **ui/screens/**: All Composable screen components
- **ui/theme/**: Material 3 theming

## Debug Info

In debug builds, a debug card shows at the bottom of the home screen indicating MCP SDK status.

## Requirements

- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 34
- Kotlin 1.9+
