#!/bin/bash

# Run React Native Demo App
# Usage: ./run-rn-demo.sh [ios|android] [simulator_name]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/../examples/react-native-demo"
PLATFORM="${1:-ios}"
SIMULATOR="${2:-iPhone 16 Pro}"

echo "⚛️  Building and running React Native demo..."
echo "   Project: $PROJECT_DIR"
echo "   Platform: $PLATFORM"

cd "$PROJECT_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    yarn install
fi

if [ "$PLATFORM" = "ios" ]; then
    echo "🍎 Running on iOS..."
    
    # Install pods if needed
    if [ ! -d "ios/Pods" ]; then
        echo "📦 Installing CocoaPods..."
        cd ios && pod install && cd ..
    fi
    
    # Run on simulator
    npx react-native run-ios --simulator="$SIMULATOR" 2>&1 | tail -30
    
elif [ "$PLATFORM" = "android" ]; then
    echo "🤖 Running on Android..."
    
    # Set JAVA_HOME if needed
    if [ -z "$JAVA_HOME" ]; then
        JAVA17=$(/usr/libexec/java_home -v 17 2>/dev/null || true)
        if [ -n "$JAVA17" ]; then
            export JAVA_HOME="$JAVA17"
        fi
    fi
    
    npx react-native run-android 2>&1 | tail -30
else
    echo "❌ Unknown platform: $PLATFORM"
    echo "Usage: $0 [ios|android] [simulator_name]"
    exit 1
fi

echo "✅ Done"
