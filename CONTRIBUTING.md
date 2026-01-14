# Contributing to Mobile Dev MCP

Thank you for your interest in contributing to Mobile Dev MCP! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn 1.22+
- For iOS development: Xcode 15+, macOS 13+
- For Android development: Android Studio, JDK 17+
- For React Native: React Native CLI

### Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/mobile-dev-mcp.git
   cd mobile-dev-mcp
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Build all packages**
   ```bash
   yarn build
   ```

4. **Run the MCP server in dev mode**
   ```bash
   yarn dev
   ```

### Project Structure

```
mobile-dev-mcp/
├── packages/
│   ├── mcp-server/          # MCP server for Cursor
│   ├── sdk-react-native/    # React Native SDK
│   ├── sdk-ios/             # iOS/macOS SDK (Swift)
│   ├── sdk-android/         # Android SDK (Kotlin)
│   └── babel-plugin-mcp/    # Babel plugin for auto-instrumentation
├── examples/
│   ├── react-native-demo/   # React Native demo app
│   ├── ios-swiftui-demo/    # iOS demo app
│   ├── android-compose-demo/# Android demo app
│   └── macos-swiftui-demo/  # macOS demo app
└── scripts/                 # Build and test scripts
```

## Development Workflow

### Running Tests

```bash
# Run all tests
yarn test

# Run E2E tests
yarn test:e2e

# Platform-specific E2E tests
yarn test:e2e:ios
yarn test:e2e:android
yarn test:e2e:rn
yarn test:e2e:macos
```

### Running Demo Apps

```bash
# React Native (iOS)
cd examples/react-native-demo && yarn ios

# React Native (Android)
cd examples/react-native-demo && yarn android

# iOS SwiftUI
cd examples/ios-swiftui-demo && swift run

# Android Compose
cd examples/android-compose-demo && ./gradlew installDebug

# macOS SwiftUI
cd examples/macos-swiftui-demo && swift run
```

### Code Style

- **TypeScript/JavaScript**: We use ESLint and Prettier
- **Swift**: Follow Swift API Design Guidelines
- **Kotlin**: Follow Kotlin Coding Conventions

Run linting:
```bash
yarn lint
```

## Contributing Guidelines

### Reporting Bugs

1. Check existing issues first
2. Use the bug report template
3. Include:
   - Platform (iOS, Android, React Native, macOS)
   - SDK version
   - Steps to reproduce
   - Expected vs actual behavior
   - Logs if applicable

### Suggesting Features

1. Check existing issues/discussions
2. Use the feature request template
3. Explain the use case and benefits
4. Consider implementation complexity

### Pull Requests

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code style
   - Add tests for new functionality
   - Update documentation if needed

3. **Test your changes**
   ```bash
   yarn test
   yarn test:e2e
   ```

4. **Commit with a descriptive message**
   ```bash
   git commit -m "feat: add new feature description"
   ```
   
   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation only
   - `style:` Code style (formatting, etc.)
   - `refactor:` Code refactoring
   - `test:` Adding tests
   - `chore:` Maintenance tasks

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **PR Requirements**
   - Clear description of changes
   - Tests pass
   - Documentation updated
   - No breaking changes (or clearly documented)

## Adding a New Tool

To add a new MCP tool:

1. **Define the tool** in `packages/mcp-server/src/tools/`
   ```typescript
   export const myNewTool = {
     name: 'my_new_tool',
     description: 'Description of what it does',
     inputSchema: {
       type: 'object',
       properties: {
         param1: { type: 'string', description: 'Parameter description' }
       },
       required: ['param1']
     }
   };
   ```

2. **Implement the handler** in the same file
   ```typescript
   export async function handleMyNewTool(params: MyNewToolParams) {
     // Implementation
     return { result: 'success' };
   }
   ```

3. **Register in index.ts**

4. **Add SDK support** if it requires device communication

5. **Add tests**

6. **Update documentation**

## Adding SDK Features

### React Native

1. Add types in `packages/sdk-react-native/src/types.ts`
2. Implement in `packages/sdk-react-native/src/MCPBridge.ts`
3. Export from `packages/sdk-react-native/src/index.ts`
4. Add tests and update README

### iOS/macOS

1. Add to `packages/sdk-ios/Sources/MobileDevMCP/MCPBridge.swift`
2. Add command handling in `handleCommand`
3. Update README

### Android

1. Add to `packages/sdk-android/src/main/kotlin/com/mobiledevmcp/MCPBridge.kt`
2. Add command handling in `handleCommandSuspend`
3. Update README

## Release Process

Releases are managed by maintainers:

1. Update version numbers
2. Update CHANGELOG.md
3. Create release PR
4. After merge, tag release
5. Publish to npm/CocoaPods/Maven

## Getting Help

- 📖 [Documentation](./README.md)
- 💬 [GitHub Discussions](https://github.com/mobile-dev-mcp/mobile-dev-mcp/discussions)
- 🐛 [Issue Tracker](https://github.com/mobile-dev-mcp/mobile-dev-mcp/issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
