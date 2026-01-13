# Demo App Scripts

Scripts to quickly build and run the MCP demo applications.

## Prerequisites

### For iOS
- macOS with Xcode installed
- iOS Simulator (comes with Xcode)
- Xcode command line tools: `xcode-select --install`

### For Android
- Android Studio with at least one AVD (Android Virtual Device)
- `ANDROID_HOME` environment variable set
- ADB in PATH

### For React Native
- Node.js 18+
- npm or yarn
- Platform-specific requirements above

## Scripts

### Run React Native Demo

```bash
./scripts/run-rn-demo.sh [platform] [simulator-name]

# Examples:
./scripts/run-rn-demo.sh ios "iPhone 15 Pro"
./scripts/run-rn-demo.sh android
```

### Run iOS SwiftUI Demo

```bash
./scripts/run-ios-demo.sh [simulator-name]

# Examples:
./scripts/run-ios-demo.sh                    # Uses iPhone 15
./scripts/run-ios-demo.sh "iPhone 15 Pro"
```

### Run Android Compose Demo

```bash
./scripts/run-android-demo.sh

# Uses first available emulator
```

## Using from Cursor

You can also use the MCP tools directly from Cursor:

```
"Run the iOS demo app"
"Run the React Native demo on iPhone 15 Pro"
"Run the Android demo app"
```

The MCP server has `run_demo_app` tool that handles this.

## Troubleshooting

### iOS Simulator not found
```bash
# List available simulators
xcrun simctl list devices available
```

### Android emulator not starting
```bash
# List available AVDs
emulator -list-avds

# Start specific emulator
emulator -avd <avd-name>
```

### Build fails
1. Try opening the project in Xcode/Android Studio directly
2. Sync dependencies (pod install / gradle sync)
3. Clean and rebuild
