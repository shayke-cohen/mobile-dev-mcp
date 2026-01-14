# Testing the MCP Server

This guide explains how to test the Mobile Dev MCP server with and without Cursor.

## Quick Start

```bash
# Build everything first
pnpm install
pnpm build

# Run E2E tests
pnpm test:e2e

# Run automated tests
node scripts/test-client.js --mode=test

# Run interactive test client
node scripts/test-client.js
```

## Running Server Separately (Recommended for Debugging)

For better visibility into server logs and easier debugging, run the server in a separate terminal:

```bash
# Terminal 1: Start server in standalone mode
pnpm start:server

# Terminal 2: Run E2E tests against existing server
pnpm test:e2e:existing --platform=ios
```

### Server Modes

| Mode | Command | Description |
|------|---------|-------------|
| **Standalone** | `pnpm start:server` | WebSocket only, for testing/debugging |
| **Normal** | (via Cursor) | stdio + WebSocket, for Cursor IDE |

### Standalone Server Options

```bash
# Default port 8765
pnpm start:server

# Custom port
MCP_PORT=9000 pnpm start:server

# Debug logging
pnpm start:server:debug
```

The standalone server displays all activity in the terminal, making it easier to debug issues.

## Testing Methods

### 1. Unit Tests

Run the built-in unit tests:

```bash
# Run all tests
pnpm test

# Run only server tests
pnpm --filter @mobile-dev-mcp/server test
```

### 2. Interactive Test Client

The test client simulates both:
- A mobile app connecting via WebSocket
- Cursor connecting via MCP protocol

```bash
# Interactive mode (default) - starts server + mock app
node scripts/test-client.js

# Or specify mode explicitly
node scripts/test-client.js --mode=both

# Just run the mock mobile app (requires server running)
node scripts/test-client.js --mode=app

# Just run the MCP client
node scripts/test-client.js --mode=mcp

# Run automated test suite
node scripts/test-client.js --mode=test
```

**Interactive Commands:**
- `1` - List all available tools
- `2` - List simulators (iOS/Android)
- `3` - Get app state (requires connected app)
- `4` - Get device info
- `5` - List feature flags
- `6` - Get logs
- `7` - Call any tool with custom arguments
- `q` - Quit

### 3. Test with Real Demo Apps

Run a demo app with SDK integration and verify it connects:

**React Native:**
```bash
cd examples/react-native-demo

# Start Metro
npx react-native start

# In another terminal, run iOS
npx react-native run-ios

# Or Android
npx react-native run-android
```

**iOS SwiftUI:**
```bash
cd examples/ios-swiftui-demo
open MCPDemoApp.xcodeproj
# Build and run in Xcode (Cmd+R)
```

**Android:**
```bash
cd examples/android-compose-demo
./gradlew installDebug
# Or open in Android Studio and run
```

Each demo app has an **MCP Status Banner** on the home screen showing:
- **Connection status** - Green/red indicator with "Connected"/"Disconnected"
- **Reconnect attempts** - Number shown when reconnecting (e.g., "(3)")
- **Last activity** - Most recent SDK activity (e.g., "← Command: get_app_state")
- **Reconnect button** - Manual reconnect trigger
- **Activity Log button** - Opens full activity log with color-coded entries

### SDK Activity Log

The activity log shows all SDK events with color coding:
- 🔴 **Red** - Errors and connection failures
- 🟢 **Green** - Successful connections
- 🔵 **Blue** - Incoming commands (← Command: get_app_state)
- 🟣 **Purple** - Outgoing responses (→ Response: get_app_state OK)

Example log entries:
```
[12:30:45] Connecting to ws://localhost:8765...
[12:30:45] Connected!
[12:30:45] Sent handshake
[12:30:50] ← Command: get_app_state
[12:30:50] → Response: get_app_state OK
[12:31:00] Disconnected: Connection closed
[12:31:03] Reconnecting in 3s (attempt 1)...
```

### 4. Test with Cursor

1. **Configure Cursor MCP Settings**

   Add to `~/.cursor/mcp.json`:
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

2. **Restart Cursor** to load the MCP server

3. **Start a demo app** (see above)

4. **Try asking Cursor:**
   - "List available simulators"
   - "What's in the user's cart?"
   - "Show the current app state"
   - "Boot iPhone 15 Pro simulator"
   - "Take a screenshot of the simulator"

## Available Tools

### Simulator Tools (No App Required)

| Tool | Description |
|------|-------------|
| `list_simulators` | List iOS Simulators & Android Emulators |
| `boot_simulator` | Boot a simulator/emulator |
| `shutdown_simulator` | Shutdown simulator/emulator |
| `simulator_screenshot` | Take a screenshot |
| `set_location` | Set GPS location |

### App Tools (Requires SDK Connection)

| Tool | Description |
|------|-------------|
| `get_app_state` | Get exposed app state |
| `get_device_info` | Get device information |
| `list_feature_flags` | List feature flags |
| `toggle_feature_flag` | Toggle a flag |
| `get_logs` | Get captured logs |
| `list_network_requests` | Get network requests |

## Troubleshooting

### "No device connected" Error

The MCP server shows this when no mobile app is connected via WebSocket:

1. Make sure a demo app is running
2. Check the MCP status banner in the app (should show "Connected")
3. Verify the app is connecting to `ws://localhost:8765`

### Server Won't Start

1. Check the server is built: `pnpm build`
2. Verify the path in your MCP config
3. Check for port conflicts on 8765

### App Won't Connect

1. Ensure you're in development/debug mode
2. The SDK auto-detects the appropriate host:
   - **iOS Simulator**: `ws://localhost:8765`
   - **Android Emulator**: `ws://10.0.2.2:8765` (auto-detected)
   - **Real devices**: Use `adb reverse tcp:8765 tcp:8765` for Android
3. For devices on different networks, specify custom server URL
4. All SDKs auto-reconnect every 3 seconds - check the reconnect counter in the status banner

### Custom Server URL

Override the default server URL when needed:

```typescript
// React Native
MCPBridge.initialize({ serverUrl: 'ws://192.168.1.100:8765' });
```

```swift
// iOS
MCPBridge.shared.initialize(serverUrl: "ws://192.168.1.100:8765")
```

```kotlin
// Android
MCPBridge.initialize(context = this, serverUrl = "ws://192.168.1.100:8765")
```

### SDK Reconnection

The SDKs automatically handle connection issues:
- **Auto-reconnect**: Retries every 3 seconds when server is unavailable
- **Server can start later**: Start your app first, then the MCP server - SDK will connect automatically
- **Connection loss recovery**: SDK reconnects automatically if server restarts
- **Manual reconnect**: Use the "Reconnect" button in the status banner

### Tests Fail

1. Rebuild: `pnpm build`
2. Check Node.js version: `node --version` (requires 18+)
3. Check for required tools: `xcrun` (iOS), `adb` (Android)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Test Client                           │
│  ┌─────────────────┐      ┌─────────────────┐          │
│  │   Mock App      │      │   MCP Client    │          │
│  │  (WebSocket)    │      │    (stdio)      │          │
│  └────────┬────────┘      └────────┬────────┘          │
└───────────┼──────────────────────────────────────────────┘
            │                        │
            │ WebSocket              │ stdio (JSON-RPC)
            │                        │
┌───────────▼────────────────────────▼────────────────────┐
│                    MCP Server                            │
│  ┌─────────────────┐      ┌─────────────────┐          │
│  │ WebSocket Server│      │    MCP Tools    │          │
│  │  (port 8765)    │      │                 │          │
│  └─────────────────┘      └─────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

## Writing Custom Tests

You can extend the test client or write your own:

```javascript
const WebSocket = require('ws');

// Connect as a mock app
const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  // Send handshake (required by server)
  ws.send(JSON.stringify({
    type: 'handshake',
    platform: 'test',
    appName: 'TestApp',
    appVersion: '1.0.0',
    deviceId: 'test_device_123',
    capabilities: ['state', 'logs', 'network', 'featureFlags']
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.method) {
    // Handle command and send response
    ws.send(JSON.stringify({
      type: 'response',
      id: msg.id,
      result: { /* your data */ }
    }));
  }
});
```

## E2E Tests

The e2e test suite performs a full integration test:
1. Starts the MCP server (or connects to existing one)
2. Boots simulators/emulators if needed
3. Builds and runs demo apps (iOS SwiftUI, Android Compose)
4. Waits for SDK connection
5. Tests all MCP tools

```bash
# Run all e2e tests (iOS + Android)
pnpm test:e2e

# iOS only
pnpm test:e2e:ios

# Android only
pnpm test:e2e:android

# Use existing server (for debugging - run pnpm start:server first)
pnpm test:e2e:existing --platform=ios

# Skip build (test already running app)
node scripts/e2e-test.js --skip-build

# Verbose output
node scripts/e2e-test.js --platform=ios -v
```

### Debugging with Separate Server

For easier debugging, run the server in one terminal and tests in another:

```bash
# Terminal 1: Start server with debug logging
pnpm start:server:debug

# Terminal 2: Run tests
pnpm test:e2e:existing --platform=android -v
```

This lets you see server logs in real-time while tests run.

### Supported Platforms

| Platform | Status | Demo App |
|----------|--------|----------|
| iOS | ✅ Fully tested | `ios-swiftui-demo` |
| Android | ✅ Fully tested | `android-compose-demo` |
| React Native | ⚠️ Manual only | `react-native-demo` |

**Note:** React Native E2E requires Metro bundler running, so it's tested manually.

### What Gets Tested

| Test | Description |
|------|-------------|
| **Setup** | |
| Server tools | 44 MCP tools registered |
| list_simulators | Lists iOS/Android devices |
| simulator_screenshot | Takes screenshot |
| **iOS** | |
| Build and run iOS | Compiles SwiftUI demo |
| iOS SDK connection | App connects via WebSocket |
| iOS: Read cart state | Verifies state inspection works |
| iOS: Take screenshot | Takes app screenshot |
| **Android** | |
| Build and run Android | Compiles Compose demo |
| Android SDK connection | App connects via WebSocket |
| **Android UI Automation** | |
| Navigate to Products | Taps Products quick action |
| Tap Add to Cart | Taps first product's Add button |
| Check cart state | Verifies cart updated |
| Navigate to Cart tab | Taps Cart in bottom nav |
| Take cart screenshot | Screenshots cart view |
| Navigate back to Home | Returns to home screen |
| **App Tools** | |
| get_app_state | Returns cart, user, products |
| get_device_info | Returns platform info |
| list_feature_flags | Returns flags |
| toggle_feature_flag | Toggles flags |
| get_logs | Returns log entries |

### UI Automation Notes

The E2E tests include basic UI automation using:
- **Android**: `adb shell input tap x y` for touch simulation
- **iOS**: State inspection only (AppleScript automation requires accessibility permissions)

Android UI automation coordinates are device-specific:
- Tested on Medium Phone API 35 (1080x2400 resolution)
- Coordinates may need adjustment for other devices/resolutions

## CI/CD Integration

For automated testing in CI:

```bash
# Run automated test suite (exits with code 0/1)
node scripts/test-client.js --mode=test

# Run e2e tests (requires simulator/emulator)
node scripts/e2e-test.js --platform=ios

# Or use the test script
./scripts/test-server.sh
```
