# MobileDevMCP iOS SDK

iOS SDK for Mobile Dev MCP - enables AI-assisted development in Cursor IDE.

## Installation

### Swift Package Manager

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
    return self?.currentUser?.dictionary
}

MCPBridge.shared.exposeState(key: "cart") { [weak self] in
    return self?.cartItems.map { $0.dictionary }
}

MCPBridge.shared.exposeState(key: "cartTotal") { [weak self] in
    return self?.cartTotal
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

// Auth actions
MCPBridge.shared.registerAction(name: "login") { [weak self] _ in
    self?.login()
    return ["loggedIn": true]
}

MCPBridge.shared.registerAction(name: "logout") { [weak self] _ in
    self?.logout()
    return ["loggedOut": true]
}
```

## Register UI Components

Enable AI to find and interact with UI elements:

```swift
MCPBridge.shared.registerComponent(
    testId: "add-to-cart-btn",
    type: "Button",
    onTap: { [weak self] in
        self?.addToCart()
    },
    getText: { "Add to Cart" }
)

MCPBridge.shared.registerComponent(
    testId: "product-title",
    type: "Text",
    getText: { product.name }
)
```

## Track Navigation

Let AI know your current screen:

```swift
// Call when navigation changes
MCPBridge.shared.setNavigationState(route: "products", params: ["category": "electronics"])
```

## Feature Flags

```swift
// Register flags
MCPBridge.shared.registerFeatureFlags([
    "darkMode": true,
    "newCheckout": false
])

// Use flags
let isDarkMode = MCPBridge.shared.getFeatureFlag("darkMode")
```

## SwiftUI Integration

```swift
import SwiftUI
import MobileDevMCP

struct ContentView: View {
    @ObservedObject var mcpBridge = MCPBridge.shared
    
    var body: some View {
        VStack {
            HStack {
                Circle()
                    .fill(mcpBridge.isConnected ? Color.green : Color.red)
                    .frame(width: 10, height: 10)
                Text(mcpBridge.isConnected ? "Connected" : "Disconnected")
            }
            Text(mcpBridge.lastActivity)
                .font(.caption)
        }
    }
}
```

## Configuration

```swift
MCPBridge.shared.initialize(
    serverUrl: "ws://192.168.1.100:8765",  // Custom server URL
    debug: true                              // Enable debug logging
)
```

## Requirements

- iOS 14.0+
- Swift 5.5+
- Xcode 13.0+

## License

MIT
