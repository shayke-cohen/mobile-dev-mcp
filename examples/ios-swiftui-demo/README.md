# iOS SwiftUI MCP Demo App

A sample iOS e-commerce app demonstrating the Mobile Dev MCP SDK integration with SwiftUI.

## Features

All screens are accessible via **TabView navigation**:

- **🏠 Home**: Welcome banner, quick actions grid, featured products, debug info
- **🛍️ Products**: Browse all products with ratings, stock status, navigation to details
- **🛒 Cart**: Manage cart items with quantity controls, subtotal, checkout
- **👤 Profile**: User authentication (sign in/out), account sections, app info

## Quick Start

```bash
# Navigate to the demo
cd examples/ios-swiftui-demo

# Build and run with xcodebuild
xcodebuild -project MCPDemoApp.xcodeproj \
  -scheme MCPDemoApp \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  build

# Or open in Xcode
open MCPDemoApp.xcodeproj
```

## Full Setup

1. **Open the Xcode project**:
   ```bash
   cd examples/ios-swiftui-demo
   open MCPDemoApp.xcodeproj
   ```

2. **Select a simulator** (iPhone 15 or newer recommended)

3. **Build and run** (Cmd+R)

## MCP SDK Integration

When the MCP SDK is integrated, the app exposes:

- **User State**: Current user, login status
- **Cart State**: Items, total, item count
- **Products State**: Available products list
- **Feature Flags**: dark_mode, new_checkout, show_recommendations

## Architecture

```
MCPDemoApp/
├── MCPDemoAppApp.swift    # App entry, @main, AppState
└── ContentView.swift      # TabView and all screen views
```

### Key Components

- **AppState**: ObservableObject with @Published properties for user, cart, products
- **ContentView**: TabView with Home, Products, Cart, Profile tabs
- **Product Views**: List, Detail, Row components
- **Cart Views**: Item row with quantity controls

## Debug Mode

In DEBUG builds, a debug banner shows on the home screen indicating MCP SDK status and example queries.

## Requirements

- Xcode 15+
- iOS 17.0+ deployment target
- macOS Sonoma or newer (recommended)
