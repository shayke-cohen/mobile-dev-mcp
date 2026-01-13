#!/bin/bash
# Run React Native Demo App

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_DIR="$PROJECT_ROOT/examples/react-native-demo"

echo "⚛️  React Native Demo Runner"
echo "============================"

PLATFORM="${1:-ios}"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    exit 1
fi

# Check for npx
if ! command -v npx &> /dev/null; then
    echo "❌ npx is not available."
    exit 1
fi

cd "$APP_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if iOS pods are installed
if [ "$PLATFORM" = "ios" ] && [ ! -d "ios/Pods" ]; then
    echo "📦 Installing CocoaPods..."
    cd ios
    pod install
    cd ..
fi

# Start Metro bundler in background if not running
if ! lsof -i:8081 > /dev/null 2>&1; then
    echo "🚀 Starting Metro bundler..."
    npx react-native start --reset-cache &
    METRO_PID=$!
    sleep 5
fi

# Run on platform
if [ "$PLATFORM" = "ios" ]; then
    echo "🍎 Running on iOS Simulator..."
    
    # Get simulator
    SIMULATOR="${2:-iPhone 15}"
    
    npx react-native run-ios --simulator="$SIMULATOR"
    
elif [ "$PLATFORM" = "android" ]; then
    echo "🤖 Running on Android Emulator..."
    
    # Check for running emulator
    if ! adb devices | grep -q "emulator"; then
        echo "⚠️  No Android emulator running. Starting one..."
        
        AVD=$(emulator -list-avds | head -1)
        if [ -n "$AVD" ]; then
            emulator -avd "$AVD" &
            adb wait-for-device
            sleep 10
        else
            echo "❌ No AVD found. Please create one in Android Studio."
            exit 1
        fi
    fi
    
    npx react-native run-android
    
else
    echo "❌ Unknown platform: $PLATFORM"
    echo "Usage: $0 [ios|android] [simulator-name]"
    exit 1
fi

echo ""
echo "✅ React Native Demo app is now running!"
echo "🔗 The app should connect to MCP server at ws://localhost:8765"
