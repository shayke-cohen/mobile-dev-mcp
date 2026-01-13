# React Native Demo - Setup Instructions

This demo app is ready to run with all source code complete.

## Quick Run (If Already Set Up)

```bash
cd examples/react-native-demo

# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

## Full Setup (From Scratch)

### Step 1: Initialize Native Projects

If the `ios/` and `android/` folders don't exist:

```bash
# Create a temp RN project
cd /tmp
npx react-native init MCPDemoApp --version 0.74.0

# Copy native folders back
cp -r /tmp/MCPDemoApp/ios examples/react-native-demo/
cp -r /tmp/MCPDemoApp/android examples/react-native-demo/
cp -r /tmp/MCPDemoApp/node_modules examples/react-native-demo/
```

### Step 2: Install iOS Pods

```bash
cd examples/react-native-demo/ios
pod install
cd ..
```

### Step 3: Run the App

**iOS:**
```bash
npx react-native run-ios
# Or specify simulator:
npx react-native run-ios --simulator="iPhone 16 Pro"
```

**Android:**
```bash
# Start emulator first, then:
npx react-native run-android
```

## File Structure

```
react-native-demo/
├── android/              # Android native project
├── ios/                  # iOS native project  
├── node_modules/         # Dependencies
├── src/
│   ├── App.tsx          # Main app with all screens ✓
│   ├── screens/         # Original separate screens (reference)
│   └── store/           # Redux store (reference)
├── index.js             # Entry point ✓
├── app.json             # App config ✓
├── package.json         # Dependencies ✓
├── metro.config.js      # Metro bundler config ✓
└── tsconfig.json        # TypeScript config ✓
```

## App Features

The app includes **bottom tab navigation** with 4 screens:

1. **Home** - Welcome banner, stats, quick actions, featured products
2. **Products** - Full product list with ratings and stock status
3. **Cart** - Cart management with quantity controls
4. **Profile** - User sign in/out, account settings, app info

## Troubleshooting

### Metro bundler issues
```bash
npx react-native start --reset-cache
```

### iOS build issues
```bash
cd ios && pod install --repo-update && cd ..
```

### Android build issues
```bash
cd android && ./gradlew clean && cd ..
```

### Wrong Xcode selected
```bash
# Set correct Xcode path
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
```

## Requirements

- Node.js 18+
- React Native 0.74
- Xcode 15+ (iOS)
- Android Studio + JDK 17 (Android)
