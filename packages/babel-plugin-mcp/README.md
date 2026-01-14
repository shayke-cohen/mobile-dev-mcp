# @mobile-dev-mcp/babel-plugin

Zero-config auto-instrumentation for React Native apps. Automatically wraps functions with tracing calls that report to Cursor through the MCP server.

> **Cross-Platform Equivalents:**
> - iOS/macOS: [MCPAutoTrace Build Plugin](../sdk-ios)
> - Android: [com.mobiledevmcp.autotrace Gradle Plugin](../mcp-android-gradle-plugin)

## Installation

```bash
yarn add -D @mobile-dev-mcp/babel-plugin
```

## Usage

Add to your Babel configuration:

### babel.config.js

```javascript
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Add MCP plugin (only active in development)
    ['@mobile-dev-mcp/babel-plugin', {
      // Options
      traceAll: false,      // Only trace exported functions
      traceClasses: true,   // Trace class methods
      traceAsync: true,     // Trace async functions
      traceArrows: false,   // Skip arrow functions (usually too noisy)
      minLines: 3,          // Skip small functions
      timing: true,         // Add performance timing
    }],
  ],
};
```

### For React Native with Metro

```javascript
// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  transformer: {
    babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `include` | `string[]` | `['**/*.tsx', '**/*.ts', '**/*.jsx', '**/*.js']` | File patterns to instrument |
| `exclude` | `string[]` | `['**/node_modules/**', '**/*.test.*']` | File patterns to skip |
| `traceAll` | `boolean` | `false` | Trace all functions, not just exported |
| `traceClasses` | `boolean` | `true` | Trace class methods |
| `traceAsync` | `boolean` | `true` | Trace async functions |
| `traceArrows` | `boolean` | `false` | Trace arrow functions |
| `minLines` | `number` | `3` | Minimum function body lines to trace |
| `timing` | `boolean` | `true` | Include performance timing |

## How It Works

The plugin transforms your code at build time. For example:

### Before

```typescript
export class UserService {
  async fetchUser(id: string) {
    const response = await api.get(`/users/${id}`);
    return response.data;
  }
}
```

### After (in development only)

```typescript
export class UserService {
  async fetchUser(id: string) {
    if (__DEV__) {
      MCPBridge.trace('UserService.fetchUser', { 
        args: { id }, 
        file: 'UserService.ts',
        startTime: Date.now()
      });
    }
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } finally {
      if (__DEV__) {
        MCPBridge.traceReturn('UserService.fetchUser');
      }
    }
  }
}
```

## Development Only

All tracing code is wrapped in `if (__DEV__)` checks, which means:

- ✅ Zero overhead in production builds
- ✅ No tracing code in release bundles
- ✅ Tree-shaking removes all instrumentation

## What Gets Traced

By default, the plugin traces:

1. **Exported functions** - Named exports and default exports
2. **Class methods** - All non-constructor methods in classes
3. **Async functions** - With proper try/finally for accurate timing

It skips:

1. **Constructors** - Too noisy and rarely useful
2. **Getters/Setters** - Property access shouldn't be traced
3. **Small functions** - Less than 3 lines by default
4. **Arrow functions** - Usually callbacks, too noisy (configurable)
5. **Test files** - No point tracing tests

## Viewing Traces

Once instrumented, function calls appear in Cursor through the MCP:

```
User: Show me function traces from the last 5 minutes

Cursor: Here are the recent function traces:
- UserService.fetchUser (2.3ms) - called 5 times
- CartService.addItem (1.2ms) - called 12 times
- ProductService.search (45ms) - called 3 times
```

## Troubleshooting

### Plugin not working

1. Make sure `__DEV__` is defined (React Native does this automatically)
2. Check that MCPBridge is initialized before traced functions run
3. Verify the file matches include patterns and doesn't match exclude

### Too much noise

Adjust options:

```javascript
{
  traceAll: false,     // Only exported functions
  traceArrows: false,  // Skip callbacks
  minLines: 5,         // Skip small functions
}
```

### Missing some functions

```javascript
{
  traceAll: true,      // Trace everything
  traceArrows: true,   // Include arrow functions
  minLines: 1,         // Include small functions
}
```

## License

MIT
