#!/bin/bash
# Run Android Compose Demo App on Emulator

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_DIR="$PROJECT_ROOT/examples/android-compose-demo"

echo "🤖 Android Compose Demo Runner"
echo "=============================="

# Check for Android SDK
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
    # Try common locations
    if [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
    elif [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    else
        echo "❌ Android SDK not found. Please set ANDROID_HOME environment variable."
        exit 1
    fi
fi

SDK_ROOT="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
export PATH="$SDK_ROOT/platform-tools:$SDK_ROOT/emulator:$SDK_ROOT/tools/bin:$PATH"

# Check for adb
if ! command -v adb &> /dev/null; then
    echo "❌ adb not found. Please install Android SDK platform-tools."
    exit 1
fi

# Check for running emulator or start one
echo "📱 Checking for Android emulator..."

DEVICE=$(adb devices | grep -E "emulator|device$" | grep -v "List" | head -1 | awk '{print $1}')

if [ -z "$DEVICE" ]; then
    echo "🚀 No emulator running. Starting one..."
    
    # List available AVDs
    AVDS=$(emulator -list-avds 2>/dev/null || true)
    
    if [ -z "$AVDS" ]; then
        echo "❌ No Android Virtual Devices found."
        echo "Please create one in Android Studio: Tools > Device Manager > Create Device"
        exit 1
    fi
    
    # Use first available AVD
    AVD=$(echo "$AVDS" | head -1)
    echo "📱 Starting emulator: $AVD"
    
    emulator -avd "$AVD" -no-snapshot-load &
    
    echo "⏳ Waiting for emulator to boot..."
    adb wait-for-device
    
    # Wait for boot to complete
    while [ "$(adb shell getprop sys.boot_completed 2>/dev/null)" != "1" ]; do
        sleep 2
    done
    
    DEVICE=$(adb devices | grep "emulator" | awk '{print $1}')
    echo "✅ Emulator ready: $DEVICE"
fi

echo "✅ Using device: $DEVICE"

# Check if gradlew exists
if [ ! -f "$APP_DIR/gradlew" ]; then
    echo "📦 Setting up Gradle wrapper..."
    cd "$APP_DIR"
    
    # Download gradle wrapper
    GRADLE_VERSION="8.5"
    WRAPPER_DIR="gradle/wrapper"
    mkdir -p "$WRAPPER_DIR"
    
    cat > "$WRAPPER_DIR/gradle-wrapper.properties" << EOF
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
EOF

    # Create gradlew script
    cat > gradlew << 'GRADLEW'
#!/bin/bash
# Gradle wrapper script

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GRADLE_HOME="$HOME/.gradle/wrapper/dists"
GRADLE_VERSION=$(grep distributionUrl gradle/wrapper/gradle-wrapper.properties | sed 's/.*gradle-\(.*\)-bin.zip/\1/')

if command -v gradle &> /dev/null; then
    gradle "$@"
else
    echo "Downloading Gradle..."
    mkdir -p "$GRADLE_HOME"
    curl -sL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o /tmp/gradle.zip
    unzip -q /tmp/gradle.zip -d "$GRADLE_HOME"
    "$GRADLE_HOME/gradle-${GRADLE_VERSION}/bin/gradle" "$@"
fi
GRADLEW
    chmod +x gradlew
    
    cd "$PROJECT_ROOT"
fi

# Build the app
echo "🔨 Building app..."
cd "$APP_DIR"

./gradlew assembleDebug --warning-mode=none 2>&1 | grep -E "(BUILD|error|warning:|:app:)" || true

APK_PATH="$APP_DIR/app/build/outputs/apk/debug/app-debug.apk"

if [ ! -f "$APK_PATH" ]; then
    echo "❌ Build failed. APK not found at: $APK_PATH"
    echo ""
    echo "💡 Try building in Android Studio:"
    echo "   1. Open $APP_DIR in Android Studio"
    echo "   2. Sync Gradle files"
    echo "   3. Build > Make Project"
    exit 1
fi

echo "✅ Build successful: $APK_PATH"

# Install the app
echo "📲 Installing app..."
adb -s "$DEVICE" install -r "$APK_PATH"

# Launch the app
echo "🚀 Launching app..."
adb -s "$DEVICE" shell am start -n com.mobiledevmcp.demo/.MainActivity

echo ""
echo "✅ Android Demo app is now running!"
echo "📱 Device: $DEVICE"
echo "🔗 The app should connect to MCP server at ws://10.0.2.2:8765"
echo "   (10.0.2.2 is the host machine from Android emulator)"
