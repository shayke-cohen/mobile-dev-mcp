# Run Android Compose Demo App

Run the native Android Jetpack Compose demo app in an emulator.

## Parameters
- `emulator` - Optional emulator name

## Steps

1. **Ensure MCP server is running**
   - Check if server is running on ws://localhost:8765
   - If not, start it with `pnpm dev:server` from root

2. **List available emulators**
   ```bash
   emulator -list-avds
   ```

3. **Start an emulator** (if needed)
   ```bash
   emulator -avd Pixel_7_API_34 &
   ```

4. **Build and run the app**
   ```bash
   cd mobile-dev-mcp/examples/android-compose-demo
   ./gradlew installDebug
   adb shell am start -n com.mobiledevmcp.demo/.MainActivity
   ```

5. **Verify MCP connection**
   - Check MCP server logs for "Device connected"
   - The app should display connection status

## Demo App Features

The Android demo includes:
- Product listing with ViewModel (to test state inspection)
- Cart functionality (to test state changes)
- Network requests (to test network tools)
- Navigation between screens
- SharedPreferences usage (to test storage tools)

## Troubleshooting

- **Build fails**: Run `./gradlew clean` and try again
- **Emulator not detected**: Run `adb devices` to check connection
- **Connection issues**: Ensure emulator can reach localhost:8765
