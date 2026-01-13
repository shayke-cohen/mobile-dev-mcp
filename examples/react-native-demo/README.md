# React Native MCP Demo App

A sample React Native e-commerce app demonstrating the Mobile Dev MCP SDK integration.

## Features

All screens are accessible via **bottom tab navigation**:

- **🏠 Home Screen**: Welcome banner, stats dashboard, quick actions, featured products
- **🛍️ Products**: Browse all products with ratings, stock status, and add-to-cart
- **🛒 Cart**: Manage cart items with quantity controls, subtotal, and checkout
- **👤 Profile**: User authentication (sign in/out), account settings, app info

## Screenshots

The app uses a consistent purple (#6200EE) theme with support for light and dark modes.

## Quick Start

```bash
# Navigate to the demo
cd examples/react-native-demo

# The app runs with core React Native dependencies
# No additional npm install needed if node_modules exists

# Run on iOS
npx react-native run-ios

# Run on Android  
npx react-native run-android
```

## Full Setup (From Scratch)

1. **Initialize native folders** (if ios/android don't exist):
   ```bash
   npx react-native init MCPDemoApp --version 0.74.0
   # Copy ios/ and android/ folders to this directory
   ```

2. **Install iOS dependencies**:
   ```bash
   cd ios && pod install && cd ..
   ```

3. **Run the app**:
   ```bash
   npx react-native run-ios
   # or
   npx react-native run-android
   ```

## MCP SDK Integration

When the MCP SDK is integrated, the app exposes:

- **App State**: User info, cart items, products
- **Network Requests**: All fetch/XHR requests captured
- **Console Logs**: All logs accessible via `get_logs`
- **Feature Flags**: Runtime toggleable flags

## Architecture

```
src/
├── App.tsx          # Main app with tab navigation and all screens
├── screens/         # Original screen components (for reference)
└── store/           # Redux store slices (for reference)
```

The simplified App.tsx contains all screens inline using React Native's core components only, with no external dependencies required.

## Debug Mode

In development mode (`__DEV__`), a debug banner shows on the home screen with MCP connection info and example queries to try.

## Requirements

- Node.js 18+
- React Native 0.74+
- Xcode 15+ (for iOS)
- Android Studio (for Android)
- Java 17+ (for Android)
