# Testing the MCP Server

This guide explains how to test the Mobile Dev MCP server with and without Cursor.

## Quick Start

```bash
# Build everything first
pnpm install
pnpm build

# Run automated tests
node scripts/test-client.js --mode=test

# Run interactive test client
node scripts/test-client.js
```

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
2. Check the WebSocket URL matches (`ws://localhost:8765`)
3. For real devices, you may need to use your computer's IP instead of localhost
4. All SDKs auto-reconnect every 3 seconds - check the reconnect counter in the status banner

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
1. Starts the MCP server
2. Boots simulators/emulators if needed
3. Builds and runs demo apps
4. Waits for SDK connection
5. Tests all MCP tools

```bash
# Run all e2e tests
pnpm test:e2e

# iOS only
pnpm test:e2e:ios

# Android only
pnpm test:e2e:android

# Skip build (test already running app)
node scripts/e2e-test.js --skip-build

# Verbose output
node scripts/e2e-test.js --platform=ios -v
```

### What Gets Tested

| Test | Description |
|------|-------------|
| Server tools | 44 MCP tools registered |
| list_simulators | Lists iOS/Android devices |
| simulator_screenshot | Takes screenshot |
| Build and run | Compiles demo app |
| SDK connection | App connects via WebSocket |
| get_app_state | Returns cart, user, products |
| get_device_info | Returns platform info |
| list_feature_flags | Returns flags |
| toggle_feature_flag | Toggles flags |
| get_logs | Returns log entries |

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
