# Run React Native Demo App

Run the React Native demo app on iOS or Android simulator.

## Parameters
- `platform` - Target platform: "ios" or "android" (default: ios)
- `simulator` - Optional specific simulator name (e.g., "iPhone 15 Pro")

## Steps

1. **Ensure MCP server is running**
   - Check if server is running on ws://localhost:8765
   - If not, start it with `yarn dev:server` from root

2. **Navigate to demo directory**
   ```bash
   cd mobile-dev-mcp/examples/react-native-demo
   ```

3. **Install dependencies** (if needed)
   ```bash
   npm install
   ```

4. **For iOS**
   ```bash
   cd ios && pod install && cd ..
   npx react-native run-ios --simulator="{{simulator}}"
   ```

5. **For Android**
   - Ensure an emulator is running or start one
   ```bash
   npx react-native run-android
   ```

6. **Verify MCP connection**
   - Watch MCP server logs for "Device connected"
   - The demo app should show a connection indicator

## Troubleshooting

- **Metro bundler issues**: Run `npx react-native start --reset-cache`
- **iOS build fails**: Try `cd ios && pod install --repo-update`
- **Android build fails**: Try `cd android && ./gradlew clean`
