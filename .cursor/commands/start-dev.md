# Start Development Environment

Start the MCP server and a demo app for local development.

## Steps

1. **Check prerequisites**
   - Verify Node.js 18+ is installed
   - Verify pnpm is installed
   - For iOS: Verify Xcode and simulators are available
   - For Android: Verify Android Studio and emulators are set up

2. **Install dependencies** (if needed)
   - Run `pnpm install` in the root directory

3. **Start the MCP server**
   - Run `pnpm dev:server` from the root directory
   - Verify it starts on ws://localhost:8765

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
   - Check MCP server logs show device connected
   - Test with a simple tool like `get_device_info`
