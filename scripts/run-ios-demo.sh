#!/bin/bash

# Run iOS SwiftUI Demo App
# Usage: ./run-ios-demo.sh [simulator_name]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/../examples/ios-swiftui-demo"
SIMULATOR="${1:-iPhone 16 Pro}"

echo "🍎 Building and running iOS demo..."
echo "   Project: $PROJECT_DIR"
echo "   Simulator: $SIMULATOR"

cd "$PROJECT_DIR"

# Check if xcodeproj exists
if [ ! -d "MCPDemoApp.xcodeproj" ]; then
    echo "❌ Xcode project not found"
    exit 1
fi

# Find simulator UDID
UDID=$(xcrun simctl list devices | grep "$SIMULATOR" | grep -v "unavailable" | head -1 | grep -oE "[A-F0-9-]{36}")

if [ -z "$UDID" ]; then
    echo "❌ Simulator '$SIMULATOR' not found"
    echo "Available simulators:"
    xcrun simctl list devices | grep "iPhone\|iPad" | head -10
    exit 1
fi

echo "   UDID: $UDID"

# Boot simulator if needed
STATE=$(xcrun simctl list devices | grep "$UDID" | grep -o "(Booted)" || echo "")
if [ -z "$STATE" ]; then
    echo "📱 Booting simulator..."
    xcrun simctl boot "$UDID" 2>/dev/null || true
    sleep 3
fi

# Open Simulator app
open -a Simulator

# Build and run
echo "🔨 Building..."
xcodebuild \
    -project MCPDemoApp.xcodeproj \
    -scheme MCPDemoApp \
    -destination "id=$UDID" \
    -configuration Debug \
    build 2>&1 | tail -20

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Install and launch
echo "🚀 Installing and launching..."
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "MCPDemoApp.app" -path "*/Debug-iphonesimulator/*" 2>/dev/null | head -1)

if [ -n "$APP_PATH" ]; then
    xcrun simctl install "$UDID" "$APP_PATH"
    xcrun simctl launch "$UDID" com.mobiledevmcp.demo
    echo "✅ App launched!"
else
    echo "⚠️  Could not find built app, trying xcodebuild run..."
    xcodebuild \
        -project MCPDemoApp.xcodeproj \
        -scheme MCPDemoApp \
        -destination "id=$UDID" \
        -configuration Debug \
        run 2>&1 | tail -5
fi

echo "✅ Done"
