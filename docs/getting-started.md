# Getting Started with Mobile Dev MCP

This guide will help you set up the Mobile Dev MCP server and integrate the SDK into your mobile or web application.

## Prerequisites

- Node.js 18+ and yarn
- Cursor IDE with MCP support
- For iOS: macOS with Xcode and iOS Simulator
- For Android: Android Studio with an emulator or adb
- For Web: Any modern browser with WebSocket support

## Installation

### Step 1: Clone and Build

```bash
git clone https://github.com/shayke-cohen/mobile-dev-mcp.git
cd mobile-dev-mcp
yarn install
yarn build
```

### Step 2: Configure Cursor

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mobile-dev": {
      "command": "node",
      "args": ["/absolute/path/to/mobile-dev-mcp/packages/mcp-server/dist/index.js"],
      "env": {
        "MCP_PORT": "8765"
      }
    }
  }
}
```

Restart Cursor to load the new MCP configuration.

### Step 3: Verify Installation

In Cursor, you can now ask:
- "List available iOS simulators"
- "What mobile dev tools are available?"

If the MCP server is working, you'll see responses from the tools.

## SDK Integration

### React Native

#### Install the SDK

```bash
yarn add @mobile-dev-mcp/react-native
```

#### Add Native Modules (iOS)

Add to your `ios/Podfile`:

```ruby
pod 'MobileDevMCP', :path => '../node_modules/@mobile-dev-mcp/react-native/ios'
```

Then run:
```bash
cd ios && pod install
```

#### Add Native Modules (Android)

In `android/settings.gradle`:
```gradle
include ':mobile-dev-mcp'
project(':mobile-dev-mcp').projectDir = new File(rootProject.projectDir, '../node_modules/@mobile-dev-mcp/react-native/android')
```

In `android/app/build.gradle`:
```gradle
dependencies {
    implementation project(':mobile-dev-mcp')
}
```

In `MainApplication.java/kt`:
```kotlin
import com.mobiledevmcp.MCPNativePackage

// In getPackages():
packages.add(MCPNativePackage())
```

#### Initialize in Your App

```typescript
// App.tsx or index.js
import { MCPBridge } from '@mobile-dev-mcp/react-native';
import { store } from './store'; // Your Redux/Zustand store

if (__DEV__) {
  // Initialize connection to MCP server
  MCPBridge.initialize({
    serverUrl: 'ws://localhost:8765', // or your Mac's IP for physical devices
    appName: 'MyApp',
    appVersion: '1.0.0',
  });

  // Connect your state management
  MCPBridge.connectStore(store);

  // Enable network interception
  MCPBridge.enableNetworkInterception();

  // Enable log capture
  MCPBridge.enableLogCapture();

  // Register feature flags
  MCPBridge.registerFeatureFlags({
    newCheckout: false,
    darkMode: true,
    betaFeatures: false,
  });
}
```

#### Using with React Navigation

```typescript
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { MCPBridge } from '@mobile-dev-mcp/react-native';

function App() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (__DEV__ && navigationRef) {
      MCPBridge.setNavigationRef(navigationRef);
    }
  }, [navigationRef]);

  return (
    <NavigationContainer ref={navigationRef}>
      {/* Your screens */}
    </NavigationContainer>
  );
}
```

#### Auto-Instrumentation (Optional)

Add the Babel plugin for automatic function tracing:

```bash
yarn add -D @mobile-dev-mcp/babel-plugin
```

Update `babel.config.js`:

```javascript
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['@mobile-dev-mcp/babel-plugin', {
      traceClasses: true,
      traceAsync: true,
      minLines: 3,
    }],
  ],
};
```

### React Web

#### Install the SDK

```bash
yarn add @mobile-dev-mcp/react
```

#### Add the Provider

```tsx
// main.tsx or index.tsx
import { MCPProvider, MCPStatusBadge } from '@mobile-dev-mcp/react';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <MCPProvider debug={true}>
    <App />
    <MCPStatusBadge />
  </MCPProvider>
);
```

#### Expose State and Register Actions

```tsx
import { useMCPState, useMCPAction } from '@mobile-dev-mcp/react';

function MyApp() {
  const [cart, setCart] = useState([]);
  
  // Expose state to AI
  useMCPState('cart', () => cart);
  
  // Register actions AI can trigger
  useMCPAction('addToCart', async (params) => {
    const product = await fetchProduct(params.productId);
    setCart(prev => [...prev, product]);
    return { success: true };
  });
  
  return <div>...</div>;
}
```

#### Auto-Instrumentation (Optional)

For Vite projects:

```typescript
// vite.config.ts
import react from '@vitejs/plugin-react';

export default {
  plugins: [
    react({
      babel: {
        plugins: [
          ['@mobile-dev-mcp/babel-plugin', { traceClasses: true }]
        ]
      }
    })
  ]
};
```

For more details, see the [React Web Integration Guide](./web-react-integration.md).

### iOS (Swift/SwiftUI)

#### Add Swift Package

In Xcode, go to File > Add Packages and add:
```
https://github.com/shayke-cohen/mobile-dev-mcp.git
```

Select the `MobileDevMCP` product.

#### Initialize

```swift
// AppDelegate.swift or App.swift
import MobileDevMCP

@main
struct MyApp: App {
    init() {
        #if DEBUG
        MCPBridge.shared.initialize(
            serverUrl: "ws://localhost:8765",
            appName: "MyApp",
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        )
        
        // Enable features
        MCPBridge.shared.enableNetworkInterception()
        MCPBridge.shared.enableUIInspection()
        MCPBridge.shared.enableLogCapture()
        
        // Register feature flags
        MCPBridge.shared.registerFeatureFlags([
            "newCheckout": false,
            "darkMode": true
        ])
        #endif
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

#### Expose State

```swift
import MobileDevMCP
import SwiftUI

class AppState: ObservableObject {
    @Published var user: User?
    @Published var cart: [CartItem] = []
    
    init() {
        #if DEBUG
        MCPBridge.shared.exposeState("user") { [weak self] in
            return self?.user
        }
        MCPBridge.shared.exposeState("cart") { [weak self] in
            return self?.cart
        }
        #endif
    }
}
```

### Android (Kotlin/Jetpack Compose)

#### Add Dependency

In `app/build.gradle.kts`:

```kotlin
dependencies {
    implementation(project(":sdk-android"))
    // or from Maven (when published):
    // implementation("com.mobiledevmcp:sdk:0.1.0")
}
```

#### Initialize

```kotlin
// Application.kt
import com.mobiledevmcp.MCPBridge

class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        if (BuildConfig.DEBUG) {
            MCPBridge.initialize(
                context = this,
                serverUrl = "ws://10.0.2.2:8765", // 10.0.2.2 for emulator localhost
                appName = "MyApp"
            )
            
            MCPBridge.enableNetworkInterception()
            MCPBridge.enableLogCapture()
            
            MCPBridge.registerFeatureFlags(mapOf(
                "newCheckout" to false,
                "darkMode" to true
            ))
        }
    }
}
```

#### Add OkHttp Interceptor

```kotlin
import com.mobiledevmcp.MCPBridge

val okHttpClient = OkHttpClient.Builder()
    .apply {
        if (BuildConfig.DEBUG) {
            addInterceptor(MCPBridge.networkAdapter.createInterceptor())
        }
    }
    .build()
```

#### Expose ViewModel State

```kotlin
import com.mobiledevmcp.MCPBridge

class AppViewModel : ViewModel() {
    private val _state = MutableStateFlow(AppState())
    val state: StateFlow<AppState> = _state.asStateFlow()
    
    init {
        if (BuildConfig.DEBUG) {
            MCPBridge.exposeState("app") { _state.value }
        }
    }
}
```

## Using with Physical Devices

When testing on physical devices, you need to use your Mac's IP address instead of `localhost`:

1. Find your Mac's IP: System Preferences > Network
2. Update the SDK initialization:

```typescript
MCPBridge.initialize({
  serverUrl: 'ws://192.168.1.xxx:8765', // Your Mac's IP
  appName: 'MyApp',
});
```

3. Ensure both devices are on the same network

## Simulator Control

The MCP server can control simulators without an app connection:

```
User: "Boot the iPhone 15 Pro simulator"
User: "Install MyApp.app on the simulator"
User: "Take a screenshot of the simulator"
User: "Set location to San Francisco"
User: "Send a push notification to MyApp"
```

## Troubleshooting

### App not connecting to MCP server

1. Check the MCP server is running: Look for `[MCP Server] Listening on port 8765` in Cursor's output
2. Verify the URL is correct (localhost:8765 for simulator, Mac IP for physical device)
3. Check firewall settings

### Simulator tools not working

1. Ensure Xcode command line tools are installed: `xcode-select --install`
2. For Android, ensure `adb` is in your PATH: `which adb`
3. Check simulator/emulator is actually installed

### State not showing

1. Verify `MCPBridge.exposeState()` or `connectStore()` was called
2. Check the exposed key name matches what you're querying
3. Ensure SDK initialization completed before state exposure

### Network requests not captured

1. Call `MCPBridge.enableNetworkInterception()` before any network calls
2. For iOS/Android native, ensure you're using the intercepted HTTP client
3. Check that requests aren't being made before SDK initialization

## Next Steps

- Read the [Full Specification](../SPECIFICATION.md) for detailed API docs
- Check out the [Example Apps](../examples/) for reference implementations
- See the [Babel Plugin README](../packages/babel-plugin-mcp/README.md) for auto-instrumentation options
