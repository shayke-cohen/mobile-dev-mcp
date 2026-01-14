# MCP Auto-Trace Gradle Plugin

Zero-config automatic instrumentation for Android apps using Mobile Dev MCP.

## Features

- **Zero Code Changes**: No annotations or manual trace calls needed
- **Bytecode-Level**: Works with Java and Kotlin code
- **Debug Only**: Only instruments debug builds by default
- **Configurable**: Include/exclude patterns for fine-grained control
- **Minimal Overhead**: Optimized ASM-based transformation

## Installation

### 1. Add the plugin to your project

**settings.gradle.kts:**
```kotlin
pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
    }
}
```

**app/build.gradle.kts:**
```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.mobiledevmcp.autotrace") version "1.0.0"  // Add this
}
```

### 2. (Optional) Configure

```kotlin
mcpAutoTrace {
    // Enable/disable (default: true for debug builds)
    enabled = true
    
    // Only trace specific packages
    include = listOf("com.myapp.**")
    
    // Skip certain classes
    exclude = listOf(
        "com.myapp.generated.**",
        "com.myapp.ui.theme.**"
    )
    
    // Trace private methods (default: false)
    tracePrivate = false
}
```

### 3. Add the MCP SDK dependency

**app/build.gradle.kts:**
```kotlin
dependencies {
    debugImplementation("com.mobiledevmcp:sdk-android:1.0.0")
}
```

## How It Works

The plugin uses Android Gradle Plugin's bytecode transformation API to inject trace calls:

**Your code:**
```kotlin
class CartViewModel {
    fun addToCart(productId: String) {
        // business logic
    }
}
```

**After transformation (debug only):**
```kotlin
class CartViewModel {
    fun addToCart(productId: String) {
        MCPBridge.trace("CartViewModel.addToCart")
        try {
            // business logic
        } finally {
            MCPBridge.traceReturn("CartViewModel.addToCart")
        }
    }
}
```

## Excluded by Default

The following patterns are excluded to avoid noise:

- `**.R` / `**.R$*` - Android resources
- `**.BuildConfig` - Build configuration
- `**.*_Factory` / `**.*_MembersInjector` - Dagger generated
- `**.Dagger*` - Dagger components
- `**.*_Impl` - Room/other generated implementations
- `**.databinding.*` - Data binding classes

## Viewing Traces

Once instrumented, use the MCP server tools to view traces:

```bash
# Get recent traces
mcp call get_traces --limit 20

# Get slow functions
mcp call get_slow_traces --threshold 100

# Start a debug session
mcp call start_debug_session --hypothesis "Cart not updating"
```

## Requirements

- Android Gradle Plugin 7.0+
- Kotlin 1.9+
- Java 17+

## License

MIT
