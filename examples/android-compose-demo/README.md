# Android Compose MCP Demo App

A sample Android e-commerce app demonstrating the Mobile Dev MCP SDK integration with Jetpack Compose and Material 3.

## Features

All screens are accessible via **bottom navigation**:

- **🏠 Home**: Welcome banner, quick actions, featured products, debug card
- **🛍️ Products**: Browse all products with add-to-cart functionality
- **🛒 Cart**: Manage cart items with quantity controls and checkout
- **👤 Profile**: User authentication (sign in/out), account settings

## Quick Start

```bash
# Navigate to the demo
cd examples/android-compose-demo

# Build and install (requires Java 17)
export JAVA_HOME=/path/to/java17
./gradlew installDebug

# Launch the app
adb shell am start -n com.mobiledevmcp.demo/.MainActivity
```

## Full Setup

1. **Open in Android Studio**:
   ```bash
   cd examples/android-compose-demo
   # Open Android Studio and select this folder
   ```

2. **Wait for Gradle sync** to complete

3. **Select an emulator** or connect a device

4. **Run** (Shift+F10 or green play button)

## MCP SDK Integration

When the MCP SDK is integrated, the app exposes:

- **User State**: Current user, login status
- **Cart State**: Items, total, item count
- **Products State**: Available products list
- **Feature Flags**: dark_mode, new_checkout, show_recommendations

For emulator, localhost works automatically. For physical devices:
```bash
adb reverse tcp:8765 tcp:8765
```

## Architecture

```
app/src/main/kotlin/com/mobiledevmcp/demo/
├── MainActivity.kt           # Single activity host
├── MCPDemoApplication.kt     # Application class, MCP init
├── viewmodel/
│   └── AppViewModel.kt       # StateFlow-based state management
└── ui/
    ├── screens/              # Composable screens
    │   ├── MainScreen.kt     # Bottom nav scaffold
    │   ├── HomeScreen.kt
    │   ├── ProductListScreen.kt
    │   ├── CartScreen.kt
    │   └── ProfileScreen.kt
    └── theme/
        └── Theme.kt          # Material 3 theming
```

### Key Components

- **AppViewModel**: Holds all app state using StateFlow
- **MainScreen**: Scaffold with BottomNavigation
- **Screen Composables**: Stateless UI components

## Debug Mode

In debug builds (`BuildConfig.DEBUG`), a debug card shows on the home screen with MCP connection info.

## Requirements

- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17 (required by Android Gradle Plugin 8.x)
- Android SDK 34
- Kotlin 1.9.22+
- Gradle 8.4+
