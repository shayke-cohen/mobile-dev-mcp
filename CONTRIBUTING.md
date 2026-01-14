# Contributing to Mobile Dev MCP

Thank you for your interest in contributing! This document provides guidelines and instructions.

## Project Structure

```
mobile-dev-mcp/
├── packages/
│   ├── mcp-server/          # Node.js MCP server
│   ├── sdk-react-native/    # React Native SDK
│   ├── sdk-ios/             # Swift/iOS SDK  
│   ├── sdk-android/         # Kotlin/Android SDK
│   └── babel-plugin/        # Auto-instrumentation (future)
├── examples/
│   ├── react-native-demo/   # RN sample app
│   ├── ios-swiftui-demo/    # iOS sample app
│   └── android-compose-demo/ # Android sample app
└── docs/                    # Documentation
```

## Development Setup

### Prerequisites

- Node.js 18+
- yarn 9+ (`npm install -g yarn`)
- TypeScript knowledge
- For iOS: Xcode 15+, Swift 5.9+
- For Android: Android Studio, Kotlin 1.9+

### Getting Started

```bash
# Clone the repo
git clone https://github.com/mobile-dev-mcp/mobile-dev-mcp.git
cd mobile-dev-mcp

# Install dependencies
yarn install

# Build all packages
yarn build

# Run MCP server in development
yarn dev:server
```

## Making Changes

### MCP Server (`packages/mcp-server/`)

1. Add new tools in `src/tools/`
2. Register in `src/tools/index.ts`
3. Build with `yarn build`
4. Test with sample apps

### React Native SDK (`packages/sdk-react-native/`)

1. Adapters handle specific functionality (state, network, etc.)
2. MCPBridge.ts is the public API
3. Test with `examples/react-native-demo/`

### iOS SDK (`packages/sdk-ios/`)

1. Swift Package structure
2. MCPBridge.swift is the main entry
3. Adapters/ contains feature implementations
4. Test with `examples/ios-swiftui-demo/`

### Android SDK (`packages/sdk-android/`)

1. Gradle library module
2. MCPBridge.kt is the singleton entry
3. adapters/ contains feature implementations
4. Test with `examples/android-compose-demo/`

## Code Style

### TypeScript
- Use strict mode
- Prefer async/await over callbacks
- Document public APIs with JSDoc

### Swift
- Follow Swift API Design Guidelines
- Use `#if DEBUG` for development-only code
- Document with Swift DocC comments

### Kotlin
- Follow Kotlin coding conventions
- Use coroutines for async operations
- Document with KDoc comments

## Adding New MCP Tools

1. **Define the tool** in `packages/mcp-server/src/tools/`:

```typescript
export const myNewTool = {
  name: 'my_new_tool',
  description: 'What this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '...' }
    }
  }
};
```

2. **Add handler** in the same file:

```typescript
export async function handleMyNewTool(
  args: Record<string, unknown>,
  deviceManager: DeviceManager
): Promise<unknown> {
  return deviceManager.sendCommand(null, {
    method: 'my_new_tool',
    params: args
  });
}
```

3. **Implement in SDKs** - Add handler in each SDK's command dispatcher

## Testing

### MCP Server
```bash
cd packages/mcp-server
yarn test
```

### Manual Testing
1. Start MCP server: `yarn dev:server`
2. Run a sample app
3. Configure Cursor to use local MCP server
4. Test tools via Cursor AI queries

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Ensure builds pass: `yarn build`
5. Write/update tests if applicable
6. Update documentation
7. Submit PR with clear description

## Commit Messages

Follow conventional commits:
- `feat: add new tool for X`
- `fix: resolve connection issue`
- `docs: update setup instructions`
- `chore: update dependencies`

## Questions?

- Open a GitHub issue for bugs
- Start a discussion for feature ideas
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
