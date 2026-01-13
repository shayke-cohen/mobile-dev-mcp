# iOS SwiftUI MCP Demo App

A sample iOS app demonstrating the Mobile Dev MCP SDK integration with SwiftUI.

## Features

- **Home Screen**: Welcome banner, quick actions, featured products
- **Product List**: Browse all products with add-to-cart functionality
- **Product Detail**: View product details and purchase options
- **Cart**: Manage cart items with quantity controls
- **Profile**: User authentication and settings

## MCP SDK Integration

The app integrates with the MCP SDK to expose:

- **User state**: Current user, login status
- **Cart state**: Items, total, count
- **Products state**: Available products
- **Feature flags**: Dark mode, new checkout, recommendations

## Setup

1. Open in Xcode:
   ```bash
   cd examples/ios-swiftui-demo
   open Package.swift
   ```

2. Build and run on iOS Simulator

3. Start the MCP server:
   ```bash
   cd packages/mcp-server
   npm run dev
   ```

4. Open Cursor and try queries like:
   - "What's in the user's cart?"
   - "Show me the app state"
   - "Toggle the dark_mode feature flag"

## Architecture

- **MCPDemoApp.swift**: App entry point with MCP initialization
- **ContentView.swift**: Main navigation and all views
- **AppState**: Observable state management

## Debug Info

In debug builds, a debug banner shows at the bottom of the home screen indicating MCP SDK is connected.
