# MobileDevMCP - iOS & macOS SDK

Swift SDK for Mobile Dev MCP - enables AI-assisted development in Cursor IDE.

[![Swift](https://img.shields.io/badge/Swift-5.5+-orange.svg)](https://swift.org)
[![Platforms](https://img.shields.io/badge/Platforms-iOS%20%7C%20macOS-blue.svg)](https://developer.apple.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔍 **State Exposure** - Let AI see your app state
- 🎮 **Action Registration** - Let AI trigger app functions
- 🌳 **Component Registration** - Let AI find and interact with UI
- 🧭 **Navigation Tracking** - Let AI know current screen
- 🔬 **Function Tracing** - Debug function calls with AI
- 📊 **Network Monitoring** - Track API calls
- 🚩 **Feature Flags** - Toggle features for testing
- 🖥️ **macOS Support** - Full support for macOS apps

## Installation

### Swift Package Manager (Recommended)

Add to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/mobile-dev-mcp/mobile-dev-mcp.git", from: "0.1.0")
]
```

Or in Xcode: File → Add Package Dependencies → Enter the repository URL.

### CocoaPods

```ruby
pod 'MobileDevMCP', '~> 0.1.0'
```

## Quick Start

```swift
import MobileDevMCP

// Initialize in AppDelegate or App init
#if DEBUG
MCPBridge.shared.initialize()
MCPBridge.shared.enableLogCapture()
MCPBridge.shared.enableNetworkInterception()
#endif
```

## Expose State

Let AI inspect your app state:

```swift
// Expose state for AI inspection
MCPBridge.shared.exposeState(key: "user") { [weak self] in
    guard let user = self?.currentUser else { return nil }
    return ["id": user.id, "name": user.name, "email": user.email]
}

MCPBridge.shared.exposeState(key: "cart") { [weak self] in
    return self?.cartItems.map { item in
        ["id": item.id, "name": item.name, "price": item.price, "quantity": item.quantity]
    }
}

MCPBridge.shared.exposeState(key: "cartTotal") { [weak self] in
    return self?.cartTotal
}

MCPBridge.shared.exposeState(key: "isLoggedIn") { [weak self] in
    return self?.isLoggedIn ?? false
}
```

## Register Actions

Let AI trigger actions in your app:

```swift
// Cart actions
MCPBridge.shared.registerAction(name: "addToCart") { [weak self] params in
    guard let productId = params["productId"] as? String else {
        throw MCPError.invalidParams("productId required")
    }
    self?.addToCart(productId: productId)
    return ["added": productId]
}

MCPBridge.shared.registerAction(name: "removeFromCart") { [weak self] params in
    guard let productId = params["productId"] as? String else {
        throw MCPError.invalidParams("productId required")
    }
    self?.removeFromCart(productId: productId)
    return ["removed": productId]
}

// Auth actions
MCPBridge.shared.registerAction(name: "login") { [weak self] params in
    self?.login()
    return ["loggedIn": true, "user": ["id": "123", "name": "John"]]
}

MCPBridge.shared.registerAction(name: "logout") { [weak self] _ in
    self?.logout()
    return ["loggedOut": true]
}

// Navigation
MCPBridge.shared.registerAction(name: "navigate") { [weak self] params in
    let route = params["route"] as? String ?? "home"
    self?.navigate(to: route)
    return ["navigatedTo": route]
}
```

## Register UI Components

Enable AI to find and interact with UI elements:

```swift
// Register a button
MCPBridge.shared.registerComponent(
    testId: "add-to-cart-btn",
    type: "Button",
    props: ["productId": product.id],
    onTap: { [weak self] in
        self?.addToCart()
    },
    getText: { "Add to Cart" }
)

// Register a text element
MCPBridge.shared.registerComponent(
    testId: "product-title",
    type: "Text",
    getText: { product.name }
)

// Register with bounds for layout inspection
MCPBridge.shared.registerComponent(
    testId: "hero-banner",
    type: "Image",
    bounds: CGRect(x: 0, y: 0, width: 375, height: 200)
)
```

## Track Navigation

Let AI know your current screen:

```swift
// Call when navigation changes
MCPBridge.shared.setNavigationState(
    route: "products", 
    params: ["category": "electronics"]
)

// SwiftUI example
.onChange(of: selectedTab) { _, newTab in
    MCPBridge.shared.setNavigationState(route: newTab)
}
```

## Auto-Instrumentation (Zero-Config)

The easiest way to enable tracing - **no code changes needed**:

### Swift Build Plugin

Add the plugin to your target in `Package.swift`:

```swift
.target(
    name: "MyApp",
    dependencies: ["MobileDevMCP"],
    plugins: [
        .plugin(name: "MCPAutoTrace", package: "MobileDevMCP")
    ]
)
```

That's it! All your functions are now automatically traced in debug builds.

### What Gets Traced

- ✅ All public and internal functions
- ✅ Class and struct methods
- ✅ Function arguments
- ✅ Return values and errors
- ✅ Execution timing
- ❌ Private functions (skipped by default)
- ❌ Very short functions (< 2 statements)
- ❌ Test files

### How It Works

The build plugin transforms your code at compile time:

```swift
// Your code:
func addToCart(_ product: Product) {
    cartItems.append(product)
}

// Transformed (debug only):
func addToCart(_ product: Product) {
    #if DEBUG
    MCPBridge.shared.trace("AppState.addToCart", info: TraceInfo(args: ["product": "\(product)"]))
    #endif
    defer {
        #if DEBUG
        MCPBridge.shared.traceReturn("AppState.addToCart")
        #endif
    }
    cartItems.append(product)
}
```

## Manual Function Tracing

For more control, you can manually trace functions:

```swift
// Trace async functions
func fetchUser(id: String) async throws -> User {
    return try await MCPBridge.shared.traceAsync("UserService.fetchUser", 
        info: TraceInfo(args: ["id": id], file: "UserService.swift")
    ) {
        return try await api.getUser(id: id)
    }
}

// Trace sync functions
func calculateTotal() -> Double {
    return MCPBridge.shared.traceSync("calculateTotal") {
        return items.reduce(0) { $0 + $1.price }
    }
}

// Manual tracing
MCPBridge.shared.trace("processOrder", info: TraceInfo(args: ["orderId": orderId]))
// ... processing ...
MCPBridge.shared.traceReturn("processOrder", returnValue: ["success": true])
```

## Feature Flags

```swift
// Register flags
MCPBridge.shared.registerFeatureFlags([
    "darkMode": true,
    "newCheckout": false,
    "showRecommendations": true
])

// Use flags
let showNewCheckout = MCPBridge.shared.getFeatureFlag("newCheckout")
```

## SwiftUI Integration

```swift
import SwiftUI
import MobileDevMCP

struct ContentView: View {
    @ObservedObject var mcpBridge = MCPBridge.shared
    
    var body: some View {
        VStack {
            // Connection status indicator
            HStack {
                Circle()
                    .fill(mcpBridge.isConnected ? Color.green : Color.red)
                    .frame(width: 10, height: 10)
                Text(mcpBridge.isConnected ? "Connected" : "Disconnected")
                    .font(.caption)
            }
            
            // Last activity
            Text(mcpBridge.lastActivity)
                .font(.caption2)
                .foregroundColor(.secondary)
            
            // Reconnect button
            if !mcpBridge.isConnected {
                Button("Reconnect") {
                    mcpBridge.reconnect()
                }
                .buttonStyle(.bordered)
            }
        }
    }
}
```

## macOS Support

The SDK fully supports macOS apps. Usage is identical to iOS:

```swift
// macOS SwiftUI App
@main
struct MyMacApp: App {
    init() {
        #if DEBUG
        MCPBridge.shared.initialize()
        #endif
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(MCPBridge.shared)
        }
    }
}
```

### macOS-Specific Notes

- Uses `NSScreen` for screen size instead of `UIScreen`
- Uses `IOKit` for device ID instead of `UIDevice.identifierForVendor`
- Sidebar navigation pattern works great with MCP component registration

## Configuration

```swift
MCPBridge.shared.initialize(
    serverUrl: "ws://192.168.1.100:8765",  // Custom server URL
    debug: true                              // Enable debug logging
)
```

Default server URLs:
- iOS Simulator: `ws://localhost:8765`
- iOS Device: `ws://YOUR_MAC_IP:8765`
- macOS: `ws://localhost:8765`

## API Reference

### Core Methods

| Method | Description |
|--------|-------------|
| `initialize(serverUrl:debug:)` | Initialize the SDK |
| `disconnect()` | Disconnect from server |
| `reconnect()` | Manually reconnect |

### State Methods

| Method | Description |
|--------|-------------|
| `exposeState(key:getter:)` | Expose state for AI |

### Action Methods

| Method | Description |
|--------|-------------|
| `registerAction(name:handler:)` | Register an action |
| `registerActions(_:)` | Register multiple actions |
| `getRegisteredActions()` | List registered actions |

### Component Methods

| Method | Description |
|--------|-------------|
| `registerComponent(testId:type:props:bounds:onTap:getText:)` | Register UI component |
| `unregisterComponent(testId:)` | Remove component |
| `updateComponentBounds(testId:bounds:)` | Update bounds |

### Navigation Methods

| Method | Description |
|--------|-------------|
| `setNavigationState(route:params:)` | Set current route |

### Tracing Methods

| Method | Description |
|--------|-------------|
| `trace(_:info:)` | Start a trace |
| `traceReturn(_:returnValue:error:)` | Complete a trace |
| `traceAsync(_:info:_:)` | Trace async function |
| `traceSync(_:info:_:)` | Trace sync function |
| `getTraces(filter:)` | Get trace history |
| `clearTraces()` | Clear traces |

### Feature Flag Methods

| Method | Description |
|--------|-------------|
| `registerFeatureFlags(_:)` | Register flags |
| `getFeatureFlag(_:)` | Get flag value |

### Capture Methods

| Method | Description |
|--------|-------------|
| `enableLogCapture()` | Enable console capture |
| `enableNetworkInterception()` | Enable network capture |

## Requirements

- iOS 14.0+ / macOS 11.0+
- Swift 5.5+
- Xcode 13.0+

## Security

- SDK is only active in `DEBUG` builds
- All communication is local (WebSocket to localhost)
- No data is sent to external servers
- Production builds exclude SDK code entirely

## License

MIT
