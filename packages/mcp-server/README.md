# @mobile-dev-mcp/server

MCP (Model Context Protocol) server for AI-assisted mobile development with Cursor IDE.

[![npm version](https://img.shields.io/npm/v/@mobile-dev-mcp/server.svg)](https://www.npmjs.com/package/@mobile-dev-mcp/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔌 **WebSocket Bridge** - Real-time communication with mobile apps
- 📱 **Multi-Platform** - iOS, Android, React Native, and macOS support
- 🔍 **State Inspection** - View app state in real-time
- 🎮 **Remote Actions** - Trigger app actions from AI
- 🌳 **Component Tree** - Inspect UI hierarchy
- 🧭 **Navigation Tracking** - Monitor navigation state
- 📊 **Network Monitoring** - Track API requests
- 🚩 **Feature Flags** - Toggle features remotely
- 🔬 **Function Tracing** - Debug function execution

## Installation

```bash
# Run directly with npx (recommended)
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

Then restart Cursor. The server will start automatically when Cursor launches.

## Available Tools

### Device Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_simulators` | List iOS simulators and Android emulators | `platform?`, `state?` |
| `boot_simulator` | Boot a simulator/emulator | `platform`, `deviceId` |
| `shutdown_simulator` | Shutdown a simulator/emulator | `platform`, `deviceId?` |
| `list_connected_devices` | List connected mobile apps | - |

### App Inspection

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_app_state` | Get app state values | `key?`, `path?` |
| `get_device_info` | Get device information | - |
| `get_app_info` | Get app information | - |
| `get_logs` | Get console logs | `limit?`, `level?` |
| `get_recent_errors` | Get recent errors | `limit?` |

### UI Inspection

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_component_tree` | Get UI component hierarchy | `includeProps?` |
| `get_layout_tree` | Get view bounds/positions | `includeHidden?` |
| `find_element` | Find elements by testId/type/text | `testId?`, `type?`, `text?` |
| `get_element_text` | Get element text content | `testId` |
| `inspect_element` | Get element at coordinates | `x`, `y` |
| `simulate_interaction` | Tap/input by testId | `type`, `target` |

### Navigation

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_navigation_state` | Get current route and history | - |
| `navigate_to` | Navigate to a route | `route`, `params?` |

### Actions

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_actions` | List registered actions | - |
| `execute_action` | Execute an action | `action`, `params?` |
| `add_to_cart` | Add product to cart | `productId` |
| `remove_from_cart` | Remove from cart | `productId` |
| `clear_cart` | Clear shopping cart | - |
| `login` | Login user | `username?`, `password?` |
| `logout` | Logout user | - |

### Feature Flags

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_feature_flags` | List all flags | - |
| `toggle_feature_flag` | Toggle a flag | `key`, `value?` |

### Network

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_network_requests` | List API requests | `limit?` |
| `mock_network_request` | Create network mock | `urlPattern`, `mockResponse` |
| `clear_network_mocks` | Clear mocks | `mockId?` |
| `replay_network_request` | Replay a request | `requestId` |

### Storage

| Tool | Description | Parameters |
|------|-------------|------------|
| `query_storage` | Query app storage | `key?`, `pattern?` |

### Tracing

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_traces` | Get function traces | `name?`, `file?`, `minDuration?`, `limit?` |
| `get_active_traces` | Get in-progress traces | - |
| `clear_traces` | Clear trace history | - |

### Screenshots

| Tool | Description | Parameters |
|------|-------------|------------|
| `simulator_screenshot` | Capture iOS/macOS screenshot | `deviceId?`, `path?` |
| `emulator_screenshot` | Capture Android screenshot | `deviceId?`, `path?` |

### Build Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `build_app` | Build mobile app | `platform`, `projectPath`, `configuration?` |
| `run_app` | Run mobile app | `platform`, `projectPath`, `deviceId?` |
| `clean_build` | Clean build artifacts | `platform`, `projectPath` |

## SDK Integration

Install the SDK in your mobile app:

| Platform | Installation |
|----------|-------------|
| **React Native** | `npm install @mobile-dev-mcp/react-native` |
| **iOS / macOS** | Swift Package Manager or CocoaPods |
| **Android** | `debugImplementation("com.mobiledevmcp:sdk:0.1.0")` |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_PORT` | WebSocket server port | `8765` |
| `MCP_DEBUG` | Enable debug logging | `false` |

### Custom Port

```json
{
  "mcpServers": {
    "mobile-dev-mcp": {
      "command": "npx",
      "args": ["@mobile-dev-mcp/server"],
      "env": {
        "MCP_PORT": "9000"
      }
    }
  }
}
```

## Troubleshooting

### Server not starting
1. Check if port 8765 is in use: `lsof -i:8765`
2. Kill existing process: `kill -9 <PID>`
3. Restart Cursor

### App not connecting
1. Ensure SDK is initialized in DEBUG mode
2. Check WebSocket URL matches (default: `ws://localhost:8765`)
3. For Android emulator, use `ws://10.0.2.2:8765`

### Tools not working
1. Verify app is connected: use `list_connected_devices`
2. Check SDK exposes required state/actions
3. Enable debug mode in SDK for detailed logs

## License

MIT
