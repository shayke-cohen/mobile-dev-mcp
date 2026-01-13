# React Native MCP Demo App

A sample React Native app demonstrating the Mobile Dev MCP SDK integration.

## Features

- **Home Screen**: Welcome banner, quick actions, cart summary
- **Product List**: Browse products with add-to-cart functionality
- **Product Detail**: View product details and purchase options
- **Cart**: Manage cart items with promo codes and checkout

## MCP SDK Integration

The app integrates with the MCP SDK to expose:

- **Redux Store**: Full state tree accessible via `get_app_state`
- **Navigation State**: Current route and navigation stack
- **Network Requests**: All fetch/XHR requests captured
- **Console Logs**: All logs accessible via `get_logs`
- **Feature Flags**: Runtime toggleable flags

## Setup

1. Install dependencies:
   ```bash
   cd examples/react-native-demo
   npm install
   # or
   yarn
   ```

2. Install iOS dependencies:
   ```bash
   cd ios && pod install && cd ..
   ```

3. Start Metro bundler:
   ```bash
   npm start
   ```

4. Run on iOS or Android:
   ```bash
   npm run ios
   # or
   npm run android
   ```

5. Start the MCP server (in another terminal):
   ```bash
   cd packages/mcp-server
   npm run dev
   ```

6. Open Cursor and try queries like:
   - "What's in the user's cart?"
   - "Show me recent network requests"
   - "Are there any errors in the logs?"
   - "Toggle the dark_mode feature flag"

## Architecture

- **App.tsx**: App entry point with MCP initialization and navigation
- **store/**: Redux store with user, cart, and products slices
- **screens/**: All screen components (Home, ProductList, ProductDetail, Cart)

## Debug Info

In development mode (`__DEV__`), a debug banner shows at the bottom of the home screen with MCP connection status and example queries.

## Promo Codes

For testing cart functionality:
- `SAVE10` - $10 off
- `SAVE20` - $20 off

## Requirements

- Node.js 18+
- React Native 0.74+
- Xcode 15+ (for iOS)
- Android Studio (for Android)
