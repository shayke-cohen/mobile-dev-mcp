# Auto-Instrumentation Design

This document describes the auto-instrumentation strategy for Mobile Dev MCP across all supported platforms.

## Overview

Auto-instrumentation automatically wraps functions with tracing calls, enabling AI assistants to:
- See function execution flow
- Inspect arguments and return values
- Measure timing and identify slow operations
- Track errors and exceptions

## Platform-Specific Approaches

### React Native (TypeScript/JavaScript)

**Technology:** Babel Plugin (build-time)

**Status:** ✅ Implemented (`@mobile-dev-mcp/babel-plugin`)

**How it works:**
1. Babel plugin transforms code during Metro bundler compilation
2. Wraps functions with `MCPBridge.trace()` and `MCPBridge.traceReturn()` calls
3. Only active when `__DEV__ === true`
4. Zero overhead in production (code is tree-shaken)

**Configuration:**
```javascript
// babel.config.js
module.exports = {
  plugins: [
    ['@mobile-dev-mcp/babel-plugin', {
      traceAll: false,        // Only trace exported functions
      traceClasses: true,     // Trace class methods
      traceAsync: true,       // Trace async functions
      traceArrows: false,     // Skip arrow functions
      minLines: 3,            // Skip small functions
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/node_modules/**'],
    }]
  ],
};
```

---

### iOS (Swift)

**Technology:** Swift Macros (build-time) + Runtime Method Swizzling (optional)

**Status:** 🔄 Design Phase

#### Option 1: Swift Macros (Recommended for Swift 5.9+)

Swift macros can transform code at compile time:

```swift
// Define macro
@attached(body)
public macro Traced() = #externalMacro(module: "MCPMacros", type: "TracedMacro")

// Usage
@Traced
class UserService {
    func fetchUser(id: String) async throws -> User {
        // Implementation
    }
}

// Expands to:
class UserService {
    func fetchUser(id: String) async throws -> User {
        return try await MCPBridge.shared.traceAsync("UserService.fetchUser", 
            info: TraceInfo(args: ["id": id], file: #file)) {
            // Implementation
        }
    }
}
```

**Pros:**
- Type-safe, compile-time transformation
- No runtime overhead when disabled
- IDE support for macro expansion

**Cons:**
- Requires Swift 5.9+ and Xcode 15+
- New technology, less mature

#### Option 2: Method Swizzling (Runtime)

For broader compatibility:

```swift
// Auto-instrument all methods of a class
MCPBridge.shared.instrumentClass(UserService.self, methods: [
    "fetchUser",
    "updateUser",
])

// Or instrument specific selectors
MCPBridge.shared.instrumentSelector(
    #selector(UserService.fetchUser),
    on: UserService.self
)
```

**Implementation approach:**
```swift
extension MCPBridge {
    func instrumentClass(_ cls: AnyClass, methods: [String]) {
        #if DEBUG
        for methodName in methods {
            let selector = Selector(methodName)
            guard let method = class_getInstanceMethod(cls, selector) else { continue }
            
            let originalIMP = method_getImplementation(method)
            let block: @convention(block) (AnyObject) -> Any? = { obj in
                let name = "\(cls).\(methodName)"
                self.trace(name, info: TraceInfo())
                defer { self.traceReturn(name) }
                
                // Call original
                typealias OriginalFunc = @convention(c) (AnyObject, Selector) -> Any?
                let original = unsafeBitCast(originalIMP, to: OriginalFunc.self)
                return original(obj, selector)
            }
            
            let newIMP = imp_implementationWithBlock(block)
            method_setImplementation(method, newIMP)
        }
        #endif
    }
}
```

**Pros:**
- Works with any Swift/Objective-C version
- Can be enabled/disabled at runtime
- Good for selective instrumentation

**Cons:**
- Only works for @objc methods
- Runtime overhead
- More complex for Swift-only code

#### Option 3: Property Wrapper (Semi-automatic)

For explicit opt-in with minimal boilerplate:

```swift
@propertyWrapper
struct Traced<T> {
    private let function: () -> T
    private let name: String
    
    var wrappedValue: T {
        MCPBridge.shared.trace(name)
        defer { MCPBridge.shared.traceReturn(name) }
        return function()
    }
}

// Usage in SwiftUI
struct CartView: View {
    @Traced var calculateTotal: () -> Double = {
        // calculation
    }
}
```

---

### Android (Kotlin)

**Technology:** Kotlin Compiler Plugin or AspectJ (build-time)

**Status:** 🔄 Design Phase

#### Option 1: Kotlin Compiler Plugin (Recommended)

Create a Kotlin compiler plugin that transforms functions:

```kotlin
// Annotation
@Target(AnnotationTarget.CLASS, AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.BINARY)
annotation class Traced

// Usage
@Traced
class UserService {
    suspend fun fetchUser(id: String): User {
        // Implementation
    }
}

// Transforms to:
class UserService {
    suspend fun fetchUser(id: String): User {
        return MCPBridge.traceAsync("UserService.fetchUser", 
            TraceInfo(args = mapOf("id" to id), file = "UserService.kt")) {
            // Original implementation
        }
    }
}
```

**Gradle Configuration:**
```kotlin
// build.gradle.kts
plugins {
    id("com.mobiledevmcp.trace") version "0.1.0"
}

mcpTrace {
    enabled = true
    include("com.myapp.services.**")
    exclude("com.myapp.generated.**")
}
```

**Pros:**
- Full Kotlin support including suspend functions
- Compile-time, no runtime reflection
- Type-safe

**Cons:**
- Complex to implement
- Kotlin version coupling

#### Option 2: AspectJ / AspectK

Use aspect-oriented programming for method interception:

```kotlin
// build.gradle.kts
plugins {
    id("io.freefair.aspectj") version "8.4"
}

dependencies {
    implementation("org.aspectj:aspectjrt:1.9.20")
}
```

```java
@Aspect
public class TracingAspect {
    @Around("execution(* com.myapp.services..*(..))")
    public Object traceMethod(ProceedingJoinPoint joinPoint) throws Throwable {
        String name = joinPoint.getSignature().toShortString();
        MCPBridge.INSTANCE.trace(name, extractArgs(joinPoint));
        try {
            Object result = joinPoint.proceed();
            MCPBridge.INSTANCE.traceReturn(name, result, null);
            return result;
        } catch (Throwable t) {
            MCPBridge.INSTANCE.traceReturn(name, null, t.getMessage());
            throw t;
        }
    }
}
```

**Pros:**
- Mature technology
- Works with Java and Kotlin
- Flexible pointcut expressions

**Cons:**
- Adds AspectJ dependency
- Build time increase
- Limited suspend function support

#### Option 3: Byte Buddy (Runtime)

For runtime instrumentation:

```kotlin
// In Application.onCreate()
if (BuildConfig.DEBUG) {
    ByteBuddy()
        .redefine(UserService::class.java)
        .method(ElementMatchers.any())
        .intercept(MethodDelegation.to(TracingInterceptor::class.java))
        .make()
        .load(classLoader)
}
```

**Pros:**
- No build-time setup
- Can instrument third-party code
- Very flexible

**Cons:**
- Runtime overhead
- Complex for suspend functions
- Android compatibility concerns

---

## Recommended Implementation Plan

### Phase 1: Manual Tracing (Current)
All platforms have `trace()` and `traceReturn()` methods for manual instrumentation.

### Phase 2: React Native Auto-instrumentation ✅
Babel plugin is implemented and ready.

### Phase 3: iOS Swift Macros (Next)
1. Create `MCPMacros` Swift package
2. Implement `@Traced` macro
3. Add to SDK as optional dependency

### Phase 4: Android Kotlin Plugin
1. Create Kotlin compiler plugin
2. Implement `@Traced` annotation
3. Publish as Gradle plugin

### Phase 5: Dynamic Runtime Instrumentation
For Cursor Debug Mode-style debugging:
1. Add runtime injection API to all SDKs
2. Enable AI to add targeted traces during debug sessions
3. Auto-cleanup after debugging

---

## Dynamic/Runtime Instrumentation API

For Debug Mode-style surgical debugging, add dynamic instrumentation:

```typescript
// React Native
MCPBridge.injectTrace('CartService.calculateTotal');
MCPBridge.injectTrace('UserService.*'); // Wildcard support
MCPBridge.removeTrace('CartService.calculateTotal');
MCPBridge.clearInjectedTraces();
```

```swift
// iOS
MCPBridge.shared.injectTrace("CartService.calculateTotal")
MCPBridge.shared.removeAllInjectedTraces()
```

```kotlin
// Android  
MCPBridge.injectTrace("CartService.calculateTotal")
MCPBridge.clearInjectedTraces()
```

This enables the AI to:
1. Analyze the bug description
2. Form hypotheses about which functions to trace
3. Inject targeted traces
4. Ask user to reproduce
5. Analyze traces
6. Fix and verify
7. Clean up traces

---

## MCP Server Tools for Tracing

| Tool | Description |
|------|-------------|
| `get_traces` | Get function traces with filtering |
| `get_active_traces` | Get in-progress function calls |
| `get_slow_traces` | Get slowest function executions |
| `get_failed_traces` | Get traces that threw errors |
| `clear_traces` | Clear trace history |

Future tools (for dynamic instrumentation):
| Tool | Description |
|------|-------------|
| `inject_trace` | Add trace to specific function |
| `remove_trace` | Remove injected trace |
| `list_injected_traces` | List currently injected traces |

---

## Security Considerations

1. **Development Only**: All tracing is disabled in production builds
2. **No Sensitive Data**: Consider filtering sensitive parameters (passwords, tokens)
3. **Size Limits**: Truncate large arguments/return values
4. **Memory Management**: Circular buffer with configurable size limit

---

## Performance Considerations

1. **Minimal Overhead**: Target < 1ms per traced call
2. **Async Logging**: Don't block main thread for trace storage
3. **Lazy Serialization**: Only serialize args/returns when requested
4. **Sampling**: For high-frequency functions, consider sampling
