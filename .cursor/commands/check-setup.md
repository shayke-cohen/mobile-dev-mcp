# Check Development Setup

Verify your development environment is correctly configured for this project.

## Run These Checks

### 1. Node.js Version
```bash
node --version
```
**Required**: v18.0.0 or higher

### 2. yarn Installed
```bash
yarn --version
```
**Required**: yarn 9.x (install with `npm install -g yarn`)

### 3. Dependencies Installed
```bash
ls node_modules/@modelcontextprotocol
```
**Expected**: Should show `sdk` directory

If missing, run:
```bash
yarn install
```

### 4. Packages Built
```bash
ls packages/mcp-server/dist
ls packages/sdk-react-native/dist
```
**Expected**: Should show compiled JS files

If missing, run:
```bash
yarn build
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
yarn typecheck
```
**Expected**: No errors

### 8. Tests Pass
```bash
yarn test
```
**Expected**: All tests pass

## Environment Checklist

- [ ] Node.js 18+ installed
- [ ] yarn installed
- [ ] Dependencies installed (`yarn install`)
- [ ] Packages built (`yarn build`)
- [ ] TypeScript compiles (`yarn typecheck`)
- [ ] Tests pass (`yarn test`)
- [ ] (iOS) Xcode installed with simulators
- [ ] (Android) Android Studio with SDK and emulators

## Quick Fix

If setup seems broken, try a clean install:
```bash
yarn clean
rm -rf node_modules
yarn install
yarn build
```
