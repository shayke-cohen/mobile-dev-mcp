# @mobile-dev-mcp/server

MCP (Model Context Protocol) server for AI-assisted mobile development with Cursor IDE.

## Features

- 🔌 **WebSocket Bridge** - Real-time communication with mobile apps
- 📱 **Multi-Platform** - iOS, Android, and React Native support
- 🔍 **State Inspection** - View app state in real-time
- 🎮 **Remote Actions** - Trigger app actions from AI
- 🌳 **Component Tree** - Inspect UI hierarchy
- 🧭 **Navigation Tracking** - Monitor navigation state
- 📊 **Network Monitoring** - Track API requests
- 🚩 **Feature Flags** - Toggle features remotely

## Installation

```bash
# Run directly with npx
npx @mobile-dev-mcp/server

# Or install globally
npm install -g @mobile-dev-mcp/server
mobile-dev-mcp
```

## Usage with Cursor

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

## Available Tools

### Device Management
- `list_simulators` - List iOS simulators
- `list_emulators` - List Android emulators
- `boot_simulator` - Boot an iOS simulator
- `boot_emulator` - Boot an Android emulator
- `list_connected_devices` - List connected mobile apps

### App Inspection
- `get_app_state` - Get app state values
- `get_device_info` - Get device information
- `get_app_info` - Get app information
- `get_logs` - Get console logs
- `get_recent_errors` - Get recent errors

### UI Inspection
- `get_component_tree` - Get UI component hierarchy
- `get_layout_tree` - Get view bounds/positions
- `find_element` - Find elements by testId/type/text
- `get_element_text` - Get element text content
- `simulate_interaction` - Tap/input by testId

### Navigation
- `get_navigation_state` - Get current route and history
- `navigate_to` - Navigate to a route

### Actions
- `list_actions` - List registered actions
- `execute_action` - Execute an action
- `add_to_cart` / `remove_from_cart` - Cart actions
- `login` / `logout` - Auth actions

### Feature Flags
- `list_feature_flags` - List all flags
- `toggle_feature_flag` - Toggle a flag

### Network
- `list_network_requests` - List API requests
- `mock_network_request` - Create network mock
- `clear_network_mocks` - Clear mocks

### Screenshots
- `simulator_screenshot` - Capture iOS screenshot
- `emulator_screenshot` - Capture Android screenshot

## SDK Integration

Install the SDK in your mobile app:

- **React Native**: `npm install @mobile-dev-mcp/react-native`
- **iOS**: Swift Package Manager or CocoaPods
- **Android**: Gradle dependency

## License

MIT
