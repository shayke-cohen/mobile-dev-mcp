# MobileDevMCP Android SDK

Android SDK for Mobile Dev MCP - enables AI-assisted development in Cursor IDE.

## Installation

### Gradle

Add to your `build.gradle.kts`:

```kotlin
dependencies {
    debugImplementation("com.mobiledevmcp:sdk:0.1.0")
}
```

Or with Groovy:

```groovy
dependencies {
    debugImplementation 'com.mobiledevmcp:sdk:0.1.0'
}
```

## Quick Start

```kotlin
import com.mobiledevmcp.MCPBridge

// Initialize in Application or MainActivity
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) {
            MCPBridge.initialize(this)
            MCPBridge.enableLogCapture()
            MCPBridge.enableNetworkInterception()
        }
    }
}
```

## Expose State

Let AI inspect your app state:

```kotlin
// Expose state for AI inspection
MCPBridge.exposeState("user") { currentUser?.toMap() }
MCPBridge.exposeState("cart") { cartItems.map { it.toMap() } }
MCPBridge.exposeState("cartTotal") { cartTotal }
```

## Register Actions

Let AI trigger actions in your app:

```kotlin
// Cart actions
MCPBridge.registerAction("addToCart") { params ->
    val productId = params["productId"] as? String
        ?: throw IllegalArgumentException("productId required")
    addToCart(productId)
    mapOf("added" to productId)
}

// Auth actions
MCPBridge.registerAction("login") { _ ->
    login()
    mapOf("loggedIn" to true)
}

MCPBridge.registerAction("logout") { _ ->
    logout()
    mapOf("loggedOut" to true)
}
```

## Register UI Components

Enable AI to find and interact with UI elements:

```kotlin
MCPBridge.registerComponent(
    testId = "add-to-cart-btn",
    type = "Button",
    onTap = { addToCart() },
    getText = { "Add to Cart" }
)

MCPBridge.registerComponent(
    testId = "product-title",
    type = "Text",
    getText = { product.name }
)
```

## Track Navigation

Let AI know your current screen:

```kotlin
// Call when navigation changes
MCPBridge.setNavigationState("products", mapOf("category" to "electronics"))
```

## Feature Flags

```kotlin
// Register flags
MCPBridge.registerFeatureFlags(mapOf(
    "darkMode" to true,
    "newCheckout" to false
))

// Use flags
val isDarkMode = MCPBridge.getFeatureFlag("darkMode")
```

## Jetpack Compose Integration

```kotlin
import androidx.compose.runtime.collectAsState
import com.mobiledevmcp.MCPBridge

@Composable
fun MCPStatusBadge() {
    val isConnected by MCPBridge.isConnected.collectAsState()
    val lastActivity by MCPBridge.lastActivity.collectAsState()
    
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .background(
                    if (isConnected) Color.Green else Color.Red,
                    CircleShape
                )
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(if (isConnected) "Connected" else "Disconnected")
    }
    Text(lastActivity, style = MaterialTheme.typography.caption)
}
```

## Configuration

```kotlin
MCPBridge.initialize(
    context = this,
    serverUrl = "ws://192.168.1.100:8765",  // Custom server URL
    debug = true                              // Enable debug logging
)
```

## Requirements

- Android API 24+ (Android 7.0)
- Kotlin 1.8+
- OkHttp 4.x
- Kotlin Coroutines

## License

MIT
