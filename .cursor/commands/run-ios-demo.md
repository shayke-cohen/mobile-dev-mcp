# Run iOS SwiftUI Demo App

Run the native iOS SwiftUI demo app in the Simulator.

## Parameters
- `simulator` - Optional simulator name (e.g., "iPhone 15 Pro")

## Steps

1. **Ensure MCP server is running**
   - Check if server is running on ws://localhost:8765
   - If not, start it with `yarn dev:server` from root

2. **List available simulators**
   ```bash
   xcrun simctl list devices available
   ```

3. **Boot a simulator** (if needed)
   ```bash
   xcrun simctl boot "iPhone 15 Pro"
   open -a Simulator
   ```

4. **Build and run the app**
   - Open `examples/ios-swiftui-demo/` in Xcode
   - Or use command line:
   ```bash
   cd mobile-dev-mcp/examples/ios-swiftui-demo
   xcodebuild -scheme MCPDemo -destination 'platform=iOS Simulator,name={{simulator}}' build
   ```

5. **Verify MCP connection**
   - Check MCP server logs for "Device connected"
   - The app should display connection status

## Demo App Features

The iOS demo includes:
- Product listing and cart (to test state inspection)
- Network requests (to test network tools)
- Navigation between screens (to test navigation state)
- User profile (to test storage tools)
