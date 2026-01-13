#!/bin/bash

# Run Android Compose Demo App
# Usage: ./run-android-demo.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/../examples/android-compose-demo"

echo "🤖 Building and running Android demo..."
echo "   Project: $PROJECT_DIR"

cd "$PROJECT_DIR"

# Check if gradle wrapper exists
if [ ! -f "gradlew" ]; then
    echo "❌ Gradle wrapper not found"
    exit 1
fi

# Check for connected devices/emulators
DEVICES=$(adb devices | grep -v "List" | grep -v "^$" | wc -l)
if [ "$DEVICES" -eq 0 ]; then
    echo "❌ No Android device/emulator connected"
    echo "Please start an emulator first:"
    echo "  emulator -list-avds"
    echo "  emulator -avd <avd_name> &"
    exit 1
fi

# Set JAVA_HOME if needed
if [ -z "$JAVA_HOME" ]; then
    JAVA17=$(/usr/libexec/java_home -v 17 2>/dev/null || true)
    if [ -n "$JAVA17" ]; then
        export JAVA_HOME="$JAVA17"
        echo "   JAVA_HOME: $JAVA_HOME"
    fi
fi

# Build and install
echo "🔨 Building..."
./gradlew installDebug 2>&1 | tail -20

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Launch app
echo "🚀 Launching..."
adb shell am start -n com.mobiledevmcp.demo/.MainActivity

echo "✅ App launched!"
