# macOS SwiftUI Demo App

A sample e-commerce app demonstrating the Mobile Dev MCP SDK integration for AI-assisted development on macOS.

## Features

- 🖥️ Native macOS SwiftUI interface with sidebar navigation
- 🛒 Full e-commerce functionality (products, cart, checkout)
- 🔌 MCP SDK integration for AI-assisted development
- 📊 Real-time state exposure to Cursor AI
- 🎮 Remote action support

## Prerequisites

- macOS 14.0+
- Xcode 15.0+
- Swift 5.9+
- MCP Server running (`npx @mobile-dev-mcp/server`)

## Running the App

### Option 1: Swift Package Manager

```bash
cd examples/macos-swiftui-demo
swift run
```

### Option 2: Xcode

1. Open the folder in Xcode
2. Select the MCPDemoApp scheme
3. Click Run (⌘R)

## MCP Integration

The app integrates with MCP through the `MCPBridge` singleton:

### Exposed State

| Key | Description |
|-----|-------------|
| `user` | Current user info |
| `isLoggedIn` | Login status |
| `products` | Product catalog |
| `cart` | Cart items |
| `cartTotal` | Total cart value |
| `cartCount` | Number of items |
| `currentView` | Current screen |

### Registered Actions

| Action | Description |
|--------|-------------|
| `addToCart` | Add product to cart |
| `removeFromCart` | Remove from cart |
| `clearCart` | Clear entire cart |
| `updateQuantity` | Update item quantity |
| `login` | Sign in user |
| `logout` | Sign out user |
| `navigate` | Navigate to view |

### Registered Components

| testId | Type | Description |
|--------|------|-------------|
| `nav-home` | Button | Home nav button |
| `nav-products` | Button | Products nav button |
| `nav-cart` | Button | Cart nav button |
| `nav-profile` | Button | Profile nav button |
| `app-title` | Text | App title |
| `cart-total` | Text | Cart total |
| `login-button` | Button | Login button |
| `logout-button` | Button | Logout button |
| `add-to-cart-{id}` | Button | Add to cart buttons |

## Architecture

```
MCPDemoApp/
├── MCPDemoAppApp.swift    # App entry point & MCP setup
├── ContentView.swift       # Main UI with navigation
└── MCP/
    └── MCPBridge.swift    # MCP SDK (inline)
```

## Testing with MCP

1. Start the MCP server:
   ```bash
   npx @mobile-dev-mcp/server
   ```

2. Run the macOS app

3. In Cursor, use MCP tools:
   ```
   - get_app_state
   - list_actions
   - add_to_cart {productId: "1"}
   - navigate_to {route: "cart"}
   ```

## License

MIT
