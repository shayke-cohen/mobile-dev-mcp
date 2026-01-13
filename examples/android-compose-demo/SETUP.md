# Android Compose Demo - Setup Instructions

This demo app is ready to run with all Kotlin source code complete.

## Quick Run

```bash
cd examples/android-compose-demo

# Set Java 17 (required)
export JAVA_HOME=/path/to/java17

# Build and install
./gradlew installDebug

# Launch the app
adb shell am start -n com.mobiledevmcp.demo/.MainActivity
```

## Using Android Studio

1. **Open Android Studio**

2. **File → Open → Select `examples/android-compose-demo`**

3. **Wait for Gradle sync** (may take a few minutes first time)

4. **Select an emulator** or connect a device

5. **Click Run** (green play button) or press Shift+F10

## File Structure

```
android-compose-demo/
├── app/
│   ├── build.gradle.kts           # App build config ✓
│   ├── proguard-rules.pro         # ProGuard rules ✓
│   └── src/main/
│       ├── AndroidManifest.xml    # App manifest ✓
│       ├── kotlin/com/mobiledevmcp/demo/
│       │   ├── MainActivity.kt        # Single activity ✓
│       │   ├── MCPDemoApplication.kt  # Application class ✓
│       │   ├── viewmodel/
│       │   │   └── AppViewModel.kt    # State management ✓
│       │   └── ui/
│       │       ├── screens/           # 5 Composable screens ✓
│       │       └── theme/Theme.kt     # Material 3 theme ✓
│       └── res/values/
│           ├── strings.xml        ✓
│           ├── colors.xml         ✓
│           └── themes.xml         ✓
├── build.gradle.kts              # Root build config ✓
├── settings.gradle.kts           # Settings ✓
├── gradle.properties             # Gradle properties ✓
├── gradlew                       # Gradle wrapper script ✓
└── gradle/wrapper/
    ├── gradle-wrapper.jar        ✓
    └── gradle-wrapper.properties ✓
```

## App Features

The app includes **bottom navigation** with 4 screens:

1. **Home** - Welcome banner, quick actions, featured products, debug card
2. **Products** - Full product list with add-to-cart buttons
3. **Cart** - Cart management with quantity controls
4. **Profile** - User sign in/out, account settings

## Java Version

Android Gradle Plugin 8.x requires Java 17. Check your version:

```bash
java -version

# If not Java 17, find available versions:
/usr/libexec/java_home -V

# Set Java 17:
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

## Starting an Emulator

```bash
# List available AVDs
~/Library/Android/sdk/emulator/emulator -list-avds

# Start an emulator
~/Library/Android/sdk/emulator/emulator -avd <AVD_NAME> &

# Check connected devices
adb devices
```

## Troubleshooting

### Gradle sync fails
- Check internet connection
- File → Invalidate Caches / Restart
- Delete `.gradle` folder and re-sync

### Build fails with SDK errors
- Tools → SDK Manager → Install missing SDKs
- Ensure Android SDK 34 is installed

### Java version error
```
Android Gradle plugin requires Java 17
```
Set JAVA_HOME to Java 17 as shown above.

### Emulator can't connect to localhost
The emulator uses 10.0.2.2 for the host machine. Update `MCPDemoApplication.kt`:
```kotlin
MCPBridge.initialize(context = this, serverUrl = "ws://10.0.2.2:8765")
```

## Requirements

- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17 (required)
- Android SDK 34
- Kotlin 1.9.22+
- Gradle 8.4+
