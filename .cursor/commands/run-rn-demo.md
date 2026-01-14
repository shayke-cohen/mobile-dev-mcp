# Run React Native Demo App

Run the React Native demo app on iOS or Android simulator.

## Quick E2E Test

The easiest way to test React Native is via E2E tests (auto-starts Metro):
```bash
yarn test:e2e:rn          # iOS
yarn test:e2e:rn-android  # Android
```

## Manual Run

### Parameters
- `platform` - Target platform: "ios" or "android" (default: ios)
- `simulator` - Optional specific simulator name (e.g., "iPhone 15 Pro")

### Steps

1. **Start MCP server** (in separate terminal)
   ```bash
   yarn start:server
   ```

2. **Navigate to demo directory**
   ```bash
   cd examples/react-native-demo
   ```

3. **Install dependencies** (first time only)
   ```bash
   yarn install
   cd ios && pod install && cd ..  # iOS only
   ```

4. **Start Metro bundler** (in separate terminal)
   ```bash
   yarn start
   ```

5. **Run the app**
   
   **For iOS:**
   ```bash
   npx react-native run-ios --simulator="iPhone 16 Pro"
   ```
   
   **For Android:**
   ```bash
   adb reverse tcp:8081 tcp:8081  # For Metro
   adb reverse tcp:8765 tcp:8765  # For MCP server
   npx react-native run-android
   ```

6. **Verify MCP connection**
   - Watch MCP server logs for "Device connected"
   - The demo app should show MCP Status Banner with "Connected"

## Troubleshooting

- **Metro bundler issues**: Run `npx react-native start --reset-cache`
- **iOS build fails**: Try `cd ios && pod install --repo-update`
- **Android build fails**: Try `cd android && ./gradlew clean`
- **Android can't connect**: Ensure `adb reverse` commands are run
