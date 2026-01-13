# iOS SwiftUI Demo - Setup Instructions

This demo has all Swift source code complete. Here's how to run it:

## Option 1: Open as Swift Package in Xcode (Quick Test)

1. Open Xcode
2. File → Open → Select `Package.swift`
3. Wait for package resolution
4. Note: This won't run as a standalone app, but you can inspect the code

## Option 2: Create Xcode Project (Recommended for Full Testing)

### Step 1: Create New Xcode Project

1. Open Xcode
2. File → New → Project
3. Select "App" under iOS
4. Configure:
   - Product Name: `MCPDemoApp`
   - Organization Identifier: `com.mobiledevmcp`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Uncheck "Include Tests"
5. Save to `examples/ios-swiftui-demo/MCPDemoApp`

### Step 2: Add MCP SDK Package

1. In Xcode: File → Add Package Dependencies
2. Enter: `../../packages/sdk-ios` (or full path)
3. Add to target: MCPDemoApp

### Step 3: Replace Generated Code

1. Delete the generated `ContentView.swift` and `MCPDemoAppApp.swift`
2. Copy our source files:
   ```bash
   cp Sources/MCPDemoApp.swift MCPDemoApp/
   cp Sources/ContentView.swift MCPDemoApp/
   ```
3. Or drag-drop from `Sources/` into Xcode

### Step 4: Build and Run

1. Select an iOS Simulator (iPhone 15 recommended)
2. Press Cmd+R or click Run
3. App should launch with the demo store UI

## File Structure

```
ios-swiftui-demo/
├── Package.swift         # Swift Package config
├── Sources/
│   ├── MCPDemoApp.swift  # App entry + state management ✓
│   └── ContentView.swift # All UI views ✓
├── README.md            # Overview
└── SETUP.md             # This file
```

## Testing MCP Integration

1. **Start MCP server:**
   ```bash
   cd ../../packages/mcp-server
   npm run dev
   ```

2. **Run iOS app in Simulator**

3. **In Cursor, try:**
   - "What's the user state?"
   - "Show cart items"
   - "List feature flags"

## Troubleshooting

### Package resolution fails
- Ensure sdk-ios Package.swift has correct paths
- Try: File → Packages → Reset Package Caches

### App crashes on launch
- Check MCP server is running on localhost:8765
- Verify #if DEBUG blocks are working

### WebSocket connection fails
- Simulator uses localhost automatically
- For physical device: use computer's IP address
