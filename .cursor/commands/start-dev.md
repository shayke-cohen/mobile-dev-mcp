# Start Development Environment

Start the MCP server and a demo app for local development.

## Steps

1. **Check prerequisites**
   - Verify Node.js 18+ is installed
   - Verify yarn is installed
   - For iOS: Verify Xcode and simulators are available
   - For Android: Verify Android Studio and emulators are set up

2. **Install dependencies** (if needed)
   - Run `yarn install` in the root directory

3. **Start the MCP server** (choose one):
   - For Cursor integration: Server starts automatically via stdio
   - For debugging/testing: `yarn start:server` (runs in standalone WebSocket-only mode)
   - For debug logging: `yarn start:server:debug`

4. **Ask which demo app to run**
   - React Native (iOS or Android)
   - iOS SwiftUI native
   - Android Compose native

5. **Start the selected demo app**
   - For React Native iOS: `cd examples/react-native-demo && npx react-native run-ios`
   - For React Native Android: `cd examples/react-native-demo && npx react-native run-android`
   - For iOS SwiftUI: Open in Xcode and run on simulator
   - For Android Compose: Open in Android Studio and run on emulator

6. **Verify connection**
   - In standalone mode: Server logs show device connected
   - In app: MCP Status Banner shows "Connected" (green)
   - Test with a simple tool like `get_device_info`

## Server Modes

| Mode | Command | Use Case |
|------|---------|----------|
| Cursor Integration | (automatic) | Normal usage with Cursor AI |
| Standalone | `yarn start:server` | Debugging, testing, development |
| Standalone Debug | `yarn start:server:debug` | Verbose logging |
