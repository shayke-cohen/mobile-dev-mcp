# MobileDevMCP - Android SDK

Android SDK for Mobile Dev MCP - enables AI-assisted development in Cursor IDE.

[![Maven Central](https://img.shields.io/maven-central/v/com.mobiledevmcp/sdk.svg)](https://search.maven.org/artifact/com.mobiledevmcp/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔍 **State Exposure** - Let AI see your app state
- 🎮 **Action Registration** - Let AI trigger app functions
- 🌳 **Component Registration** - Let AI find and interact with UI
- 🧭 **Navigation Tracking** - Let AI know current screen
- 🔬 **Function Tracing** - Debug function calls with AI
- 📊 **Network Monitoring** - Track API calls
- 🚩 **Feature Flags** - Toggle features for testing
- 🚀 **Coroutine Support** - First-class Kotlin coroutines integration

## Installation

### Gradle (Kotlin DSL)

```kotlin
dependencies {
    debugImplementation("com.mobiledevmcp:sdk:0.1.0")
}
```

### Gradle (Groovy)

```groovy
dependencies {
    debugImplementation 'com.mobiledevmcp:sdk:0.1.0'
}
```

> **Note:** Using `debugImplementation` ensures the SDK is only included in debug builds.

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
MCPBridge.exposeState("user") { 
    currentUser?.let { 
        mapOf("id" to it.id, "name" to it.name, "email" to it.email) 
    }
}

MCPBridge.exposeState("cart") { 
    cartItems.map { item ->
        mapOf(
            "id" to item.id,
            "name" to item.name,
            "price" to item.price,
            "quantity" to item.quantity
        )
    }
}

MCPBridge.exposeState("cartTotal") { cartTotal }

MCPBridge.exposeState("isLoggedIn") { isLoggedIn }
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

MCPBridge.registerAction("removeFromCart") { params ->
    val productId = params["productId"] as? String
        ?: throw IllegalArgumentException("productId required")
    removeFromCart(productId)
    mapOf("removed" to productId)
}

// Auth actions
MCPBridge.registerAction("login") { params ->
    val username = params["username"] as? String
    val password = params["password"] as? String
    login(username, password)
    mapOf("loggedIn" to true, "user" to mapOf("id" to "123", "name" to "John"))
}

MCPBridge.registerAction("logout") { _ ->
    logout()
    mapOf("loggedOut" to true)
}

// Navigation
MCPBridge.registerAction("navigate") { params ->
    val route = params["route"] as? String ?: "home"
    navigate(route)
    mapOf("navigatedTo" to route)
}
```

## Register UI Components

Enable AI to find and interact with UI elements:

```kotlin
// Register a button
MCPBridge.registerComponent(
    testId = "add-to-cart-btn",
    type = "Button",
    props = mapOf("productId" to product.id),
    onTap = { addToCart() },
    getText = { "Add to Cart" }
)

// Register a text element
MCPBridge.registerComponent(
    testId = "product-title",
    type = "Text",
    getText = { product.name }
)

// Register with bounds for layout inspection
MCPBridge.registerComponent(
    testId = "hero-banner",
    type = "Image",
    bounds = Bounds(x = 0f, y = 0f, width = 375f, height = 200f)
)
```

## Track Navigation

Let AI know your current screen:

```kotlin
// Call when navigation changes
MCPBridge.setNavigationState("products", mapOf("category" to "electronics"))

// In Compose navigation
LaunchedEffect(currentRoute) {
    MCPBridge.setNavigationState(currentRoute)
}
```

## Function Tracing

Debug function execution with AI assistance:

```kotlin
// Trace suspend functions
suspend fun fetchUser(id: String): User {
    return MCPBridge.traceAsync("UserService.fetchUser",
        info = TraceInfo(args = mapOf("id" to id), file = "UserService.kt")
    ) {
        api.getUser(id)
    }
}

// Trace regular functions
fun calculateTotal(): Double {
    return MCPBridge.traceSync("calculateTotal") {
        items.sumOf { it.price }
    }
}

// Manual tracing
MCPBridge.trace("processOrder", TraceInfo(args = mapOf("orderId" to orderId)))
// ... processing ...
MCPBridge.traceReturn("processOrder", mapOf("success" to true))
```

## Feature Flags

```kotlin
// Register flags
MCPBridge.registerFeatureFlags(mapOf(
    "darkMode" to true,
    "newCheckout" to false,
    "showRecommendations" to true
))

// Use flags
val showNewCheckout = MCPBridge.getFeatureFlag("newCheckout")
```

## Jetpack Compose Integration

```kotlin
import androidx.compose.runtime.collectAsState
import com.mobiledevmcp.MCPBridge

@Composable
fun MCPStatusBadge() {
    val isConnected by MCPBridge.isConnected.collectAsState()
    val lastActivity by MCPBridge.lastActivity.collectAsState()
    
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(8.dp)
    ) {
        // Connection indicator
        Box(
            modifier = Modifier
                .size(10.dp)
                .background(
                    color = if (isConnected) Color.Green else Color.Red,
                    shape = CircleShape
                )
        )
        
        Spacer(modifier = Modifier.width(8.dp))
        
        Column {
            Text(
                text = if (isConnected) "Connected" else "Disconnected",
                style = MaterialTheme.typography.bodySmall
            )
            Text(
                text = lastActivity,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
    
    // Reconnect button
    if (!isConnected) {
        Button(
            onClick = { MCPBridge.reconnect() },
            modifier = Modifier.padding(top = 8.dp)
        ) {
            Text("Reconnect")
        }
    }
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

Default server URLs:
- Emulator: `ws://10.0.2.2:8765` (maps to localhost on host machine)
- Physical device: `ws://YOUR_MAC_IP:8765`

## API Reference

### Core Methods

| Method | Description |
|--------|-------------|
| `initialize(context, serverUrl?, debug?)` | Initialize the SDK |
| `disconnect()` | Disconnect from server |
| `reconnect()` | Manually reconnect |

### State Methods

| Method | Description |
|--------|-------------|
| `exposeState(key, getter)` | Expose state for AI |

### Action Methods

| Method | Description |
|--------|-------------|
| `registerAction(name, handler)` | Register an action |
| `registerActions(actions)` | Register multiple actions |
| `getRegisteredActions()` | List registered actions |

### Component Methods

| Method | Description |
|--------|-------------|
| `registerComponent(testId, type, props?, bounds?, onTap?, getText?)` | Register UI component |
| `unregisterComponent(testId)` | Remove component |
| `updateComponentBounds(testId, bounds)` | Update bounds |

### Navigation Methods

| Method | Description |
|--------|-------------|
| `setNavigationState(route, params?)` | Set current route |

### Tracing Methods

| Method | Description |
|--------|-------------|
| `trace(name, info?)` | Start a trace |
| `traceReturn(name, returnValue?, error?)` | Complete a trace |
| `traceAsync(name, info?, block)` | Trace suspend function |
| `traceSync(name, info?, block)` | Trace regular function |
| `getTraces(filter?)` | Get trace history |
| `clearTraces()` | Clear traces |

### Feature Flag Methods

| Method | Description |
|--------|-------------|
| `registerFeatureFlags(flags)` | Register flags |
| `getFeatureFlag(key)` | Get flag value |

### Capture Methods

| Method | Description |
|--------|-------------|
| `enableLogCapture()` | Enable console capture |
| `enableNetworkInterception()` | Enable network capture |

### StateFlow Properties

| Property | Type | Description |
|----------|------|-------------|
| `isConnected` | `StateFlow<Boolean>` | Connection status |
| `lastActivity` | `StateFlow<String>` | Last activity message |
| `reconnectCount` | `StateFlow<Int>` | Reconnection attempts |

## Requirements

- Android API 24+ (Android 7.0)
- Kotlin 1.8+
- Kotlin Coroutines 1.6+

## Dependencies

The SDK includes these dependencies:
- OkHttp 4.x (WebSocket client)
- Kotlin Coroutines (async support)
- Gson (JSON serialization)

## Security

- SDK only active in debug builds (use `debugImplementation`)
- All communication is local (WebSocket to localhost/emulator host)
- No data is sent to external servers
- Release builds don't include SDK code

## Troubleshooting

### Can't connect from emulator
```kotlin
// Use 10.0.2.2 to access host machine from emulator
MCPBridge.initialize(this, "ws://10.0.2.2:8765")
```

### Can't connect from physical device
```kotlin
// Use your Mac's IP address
MCPBridge.initialize(this, "ws://192.168.1.100:8765")
```

### Actions not responding
```kotlin
// Ensure actions run on main thread for UI updates
MCPBridge.registerAction("updateUI") { params ->
    withContext(Dispatchers.Main) {
        updateUI(params)
    }
    mapOf("success" to true)
}
```

## License

MIT
