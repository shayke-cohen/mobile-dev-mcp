# Check Development Setup

Verify your development environment is correctly configured for this project.

## Run These Checks

### 1. Node.js Version
```bash
node --version
```
**Required**: v18.0.0 or higher

### 2. pnpm Installed
```bash
pnpm --version
```
**Required**: pnpm 9.x (install with `npm install -g pnpm`)

### 3. Dependencies Installed
```bash
ls node_modules/@modelcontextprotocol
```
**Expected**: Should show `sdk` directory

If missing, run:
```bash
pnpm install
```

### 4. Packages Built
```bash
ls packages/mcp-server/dist
ls packages/sdk-react-native/dist
```
**Expected**: Should show compiled JS files

If missing, run:
```bash
pnpm build
```

### 5. iOS Development (macOS only)
```bash
xcode-select -p
xcrun simctl list devices available | head -20
```
**Expected**: Xcode path and list of simulators

### 6. Android Development
```bash
echo $ANDROID_HOME
adb devices
emulator -list-avds
```
**Expected**: Android SDK path and available emulators

### 7. TypeScript
```bash
pnpm typecheck
```
**Expected**: No errors

### 8. Tests Pass
```bash
pnpm test
```
**Expected**: All tests pass

## Environment Checklist

- [ ] Node.js 18+ installed
- [ ] pnpm installed
- [ ] Dependencies installed (`pnpm install`)
- [ ] Packages built (`pnpm build`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] Tests pass (`pnpm test`)
- [ ] (iOS) Xcode installed with simulators
- [ ] (Android) Android Studio with SDK and emulators

## Quick Fix

If setup seems broken, try a clean install:
```bash
pnpm clean
rm -rf node_modules
pnpm install
pnpm build
```
