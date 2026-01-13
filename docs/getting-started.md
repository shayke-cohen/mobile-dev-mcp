# Getting Started with Mobile Dev MCP

This guide will help you set up Mobile Dev MCP to enable AI-assisted development for your mobile apps in Cursor.

## Prerequisites

- [Cursor IDE](https://cursor.sh) installed
- Node.js 18+ (for MCP server)
- A mobile app (React Native, iOS, or Android)

## Step 1: Configure Cursor

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mobile-dev-mcp": {
      "command": "npx",
      "args": ["-y", "@mobile-dev-mcp/server@latest"],
      "env": {
        "MCP_PORT": "8765",
        "MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

Restart Cursor to load the configuration.

## Step 2: Install the SDK

Choose the SDK for your platform:

### React Native

```bash
npm install @mobile-dev-mcp/react-native
# or
yarn add @mobile-dev-mcp/react-native
```

### iOS (Swift Package Manager)

Add to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/mobile-dev-mcp/sdk-ios.git", from: "1.0.0")
]
```

Or in Xcode: File → Add Packages → Enter the URL.

### Android (Gradle)

Add to your `build.gradle.kts`:

```kotlin
dependencies {
    debugImplementation("com.mobiledevmcp:sdk-android:1.0.0")
}
```

## Step 3: Initialize the SDK

### React Native

```typescript
// App.tsx
import { MCPBridge } from '@mobile-dev-mcp/react-native';
import store from './store';

if (__DEV__) {
  // Initialize with default settings
  MCPBridge.initialize({
    serverUrl: 'ws://localhost:8765',
    autoConnect: true,
  });
  
  // Expose your Redux/Zustand store
  MCPBridge.exposeState('store', () => store.getState());
  
  // Expose navigation state
  MCPBridge.setNavigationRef(navigationRef);
  
  // Enable automatic network interception
  MCPBridge.enableNetworkInterception();
  
  // Enable log capturing
  MCPBridge.enableLogCapture();
}
```

### iOS (Swift)

```swift
// App.swift
import MobileDevMCP

#if DEBUG
@main
struct MyApp: App {
    init() {
        MCPBridge.shared.initialize(serverUrl: "ws://localhost:8765")
        
        // Expose view models
        MCPBridge.shared.exposeState(key: "user") {
            UserViewModel.shared.currentUser
        }
        
        MCPBridge.shared.enableNetworkInterception()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
#endif
```

### Android (Kotlin)

```kotlin
// MainApplication.kt
import com.mobiledevmcp.MCPBridge

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        if (BuildConfig.DEBUG) {
            MCPBridge.initialize(
                context = this,
                serverUrl = "ws://localhost:8765"
            )
            
            // Expose ViewModels
            MCPBridge.exposeState("user") {
                UserViewModel.currentUser.value
            }
            
            MCPBridge.enableNetworkInterception()
        }
    }
}
```

## Step 4: Verify Connection

1. Start your mobile app
2. Open Cursor IDE
3. Ask the AI: "What devices are connected?"

If connected, the AI will list your app. If not, check:
- Is the MCP server running? (Check Cursor's MCP output)
- Is your app running in development mode?
- Is the SDK initialized correctly?

## Step 5: Start Using It!

Try these prompts in Cursor:

- "What is the current app state?"
- "Show me recent network requests"
- "Are there any errors in the logs?"
- "Take a screenshot of the current screen"
- "Toggle the 'dark_mode' feature flag"

## Troubleshooting

### "No device connected"

- Ensure your app is running in development/debug mode
- Check that the SDK is initialized (look for "MCP SDK initialized" in logs)
- Verify the WebSocket port (8765) is not blocked

### Connection keeps dropping

- Check your device/emulator network settings
- Ensure localhost is accessible (for physical devices, use `adb reverse tcp:8765 tcp:8765`)

### State not showing

- Make sure you called `exposeState()` for the state you want to inspect
- State must be serializable (no circular references, functions, etc.)

## Next Steps

- Read the [full specification](../SPECIFICATION.md) for detailed API documentation
- Check out the [sample apps](../examples/) for reference implementations
- Explore [advanced features](./advanced.md) like auto-instrumentation
