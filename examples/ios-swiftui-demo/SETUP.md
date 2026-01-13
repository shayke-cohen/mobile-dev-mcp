# iOS SwiftUI Demo - Setup Instructions

This demo app is ready to run with all Swift source code complete.

## Quick Run

```bash
cd examples/ios-swiftui-demo

# Build and run with xcodebuild
xcodebuild -project MCPDemoApp.xcodeproj \
  -scheme MCPDemoApp \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  build

# Install and launch
xcrun simctl install booted build/Debug-iphonesimulator/MCPDemoApp.app
xcrun simctl launch booted com.mobiledevmcp.demo

# Or simply open in Xcode
open MCPDemoApp.xcodeproj
```

## Using Xcode

1. **Open Xcode project:**
   ```bash
   open MCPDemoApp.xcodeproj
   ```

2. **Select a simulator** (iPhone 15 or newer recommended)

3. **Build and run** (Cmd+R)

## File Structure

```
ios-swiftui-demo/
├── MCPDemoApp.xcodeproj/     # Xcode project
├── MCPDemoApp/
│   ├── MCPDemoAppApp.swift   # @main App entry + AppState ✓
│   └── ContentView.swift     # TabView + all screens ✓
├── Sources/                   # Original source (reference)
│   ├── MCPDemoApp.swift      # With MCP SDK imports
│   └── ContentView.swift     
├── Package.swift             # Swift Package config
├── README.md
└── SETUP.md
```

## App Features

The app includes **TabView navigation** with 4 tabs:

1. **Home** - Welcome banner, quick actions grid, featured products
2. **Products** - Product list with navigation to detail view
3. **Cart** - Cart management with quantity +/- controls
4. **Profile** - User sign in/out, account sections, app info

## Building from Command Line

```bash
# Build for simulator
xcodebuild -project MCPDemoApp.xcodeproj \
  -scheme MCPDemoApp \
  -destination 'id=<SIMULATOR_UUID>' \
  -configuration Debug \
  build

# List available simulators
xcrun simctl list devices available

# Install on booted simulator
xcrun simctl install booted /path/to/MCPDemoApp.app

# Launch
xcrun simctl launch booted com.mobiledevmcp.demo
```

## Troubleshooting

### Build fails with signing errors
- Open Xcode, go to Signing & Capabilities
- Select "Automatically manage signing"
- Choose your development team (or Personal Team)

### Simulator not found
```bash
# List available simulators
xcrun simctl list devices

# Boot a specific simulator
xcrun simctl boot "iPhone 16 Pro"
```

### Package resolution fails (if using Package.swift)
- File → Packages → Reset Package Caches
- Ensure sdk-ios Package.swift exists at the correct path

## Requirements

- Xcode 15+
- iOS 17.0+ deployment target
- macOS Sonoma or newer (recommended)
