# Mobile Dev MCP Commands

Quick reference for commands you can use in Cursor chat.

## Simulator Commands

```
/simulators              - List all iOS Simulators and Android Emulators
/boot iPhone 15 Pro      - Boot a specific simulator
/boot android Pixel_7    - Boot an Android emulator
/shutdown                - Shutdown all simulators
/shutdown ios            - Shutdown iOS simulators only
```

## App Management

```
/install /path/to/MyApp.app     - Install iOS app
/install /path/to/app.apk       - Install Android app
/launch com.mycompany.myapp     - Launch app by bundle ID
/terminate com.mycompany.myapp  - Force stop an app
/uninstall com.mycompany.myapp  - Uninstall an app
```

## Screenshots & Recording

```
/screenshot              - Take simulator screenshot
/screenshot ios          - Take iOS simulator screenshot
/screenshot android      - Take Android emulator screenshot
/record start            - Start recording video
/record stop             - Stop recording and save video
```

## Location & Deep Links

```
/location 37.7749 -122.4194    - Set GPS to San Francisco
/location tokyo                 - Set GPS to Tokyo (AI resolves coordinates)
/url myapp://home              - Open deep link
/url https://example.com       - Open URL in simulator browser
```

## Push Notifications (iOS)

```
/push com.myapp                - Send test notification
/push com.myapp "Hello World"  - Send notification with message
```

## Build & Run

```
/build ios               - Build iOS project in current directory
/build android           - Build Android project
/run ios                 - Build and run on iOS simulator
/run android             - Build and run on Android emulator
/clean                   - Clean build artifacts
/status                  - Check build status
```

## Demo Apps

```
/demo ios                - Run the iOS SwiftUI demo app
/demo android            - Run the Android Compose demo app
/demo rn                 - Run the React Native demo app
/demo rn "iPhone 15 Pro" - Run RN demo on specific simulator
```

## App Inspection (requires SDK)

These commands require your app to be running with the MCP SDK connected:

```
/state                   - Show full app state
/state user              - Show user state
/state cart.items        - Show specific state path
/storage                 - Query AsyncStorage/UserDefaults
/nav                     - Show navigation stack
/flags                   - List feature flags
/toggle darkMode         - Toggle a feature flag
```

## Network (requires SDK)

```
/network                 - List recent HTTP requests
/network POST            - Filter by method
/network /api/users      - Filter by URL
/mock /api/users {"id":1}  - Mock an API endpoint
/unmock                  - Clear all mocks
```

## UI Inspection (requires SDK)

```
/capture                 - Screenshot from app (via SDK)
/tree                    - Get view hierarchy
/tap 100 200             - Simulate tap at coordinates
/tap loginButton         - Tap element by testID
/swipe up                - Simulate swipe gesture
/navigate Home           - Navigate to a route
```

## Logs (requires SDK)

```
/logs                    - Show recent console logs
/logs error              - Show only errors
/logs "fetch"            - Filter by keyword
/errors                  - Show recent errors/crashes
/trace                   - Show function call traces
/trace fetchUser         - Show traces for specific function
```

## Device Info

```
/device                  - Show connected device info
/devices                 - List all connected devices
/permissions             - Check app permissions
/container com.myapp     - Get app data directory path
```

## Natural Language

You can also use natural language - the AI will figure out the right tool:

```
"Boot the iPhone 15 simulator"
"Show me what network requests the app is making"
"Take a screenshot and show me the view hierarchy"
"Mock the users API to return an empty array"
"What's the current navigation state?"
"Run the demo app on iPad"
"Set the location to New York City"
"Send a push notification to test the handler"
```

## Workflows

### Debug a crash
```
/errors                  - See what crashed
/state                   - Check app state at crash
/trace                   - See function calls leading to crash
/logs error              - Check error logs
```

### Test offline mode
```
/mock /api/* {"error": "offline"}   - Mock all APIs to fail
# Test app behavior
/unmock                              - Restore normal operation
```

### Performance testing
```
/trace                   - Enable function tracing
# Use the app
/trace                   - See timing data
```

### UI testing
```
/boot iPhone 15
/run ios
/tap loginButton
/type username "test@test.com"
/tap passwordField
/type password "secret"
/tap submitButton
/screenshot
```

## Tips

1. **Tab completion**: Start typing a command and Cursor may suggest completions

2. **Chaining**: Ask for multiple things at once:
   > "Boot the simulator, run the demo app, and take a screenshot"

3. **Context-aware**: The AI remembers context:
   > "/boot iPhone 15"
   > "/install" (knows to use iOS)

4. **Error recovery**: If something fails, the AI will suggest fixes:
   > "No simulator booted" → AI suggests booting one first

5. **Path shortcuts**: Use relative paths from your workspace:
   > "/install ./build/MyApp.app"
