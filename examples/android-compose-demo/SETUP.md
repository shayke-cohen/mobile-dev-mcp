# Android Compose Demo - Setup Instructions

This demo has all Kotlin source code complete. Here's how to run it:

## Setup Steps

### Step 1: Install Gradle Wrapper

The project needs the Gradle wrapper. Run from project root:

```bash
cd examples/android-compose-demo

# Option A: Use gradle to generate wrapper (if gradle is installed)
gradle wrapper --gradle-version 8.4

# Option B: Copy from another Android project
# Or create manually (see below)
```

### Step 2: Create Missing Gradle Wrapper Files

If you don't have gradle installed, create these files:

**gradlew** (Unix shell script):
```bash
#!/bin/sh
exec gradle "$@"
```

**gradlew.bat** (Windows batch):
```batch
@echo off
gradle %*
```

Make gradlew executable:
```bash
chmod +x gradlew
```

### Step 3: Add Launcher Icons

Create placeholder icons (or add your own):

```bash
mkdir -p app/src/main/res/mipmap-hdpi
mkdir -p app/src/main/res/mipmap-mdpi
mkdir -p app/src/main/res/mipmap-xhdpi
mkdir -p app/src/main/res/mipmap-xxhdpi
mkdir -p app/src/main/res/mipmap-xxxhdpi

# Icons will be auto-generated when you open in Android Studio
# Or use Android Studio's Image Asset Studio
```

### Step 4: Open in Android Studio

1. Open Android Studio
2. File → Open → Select `examples/android-compose-demo`
3. Wait for Gradle sync (may take a few minutes first time)
4. If prompted about Gradle wrapper, click "OK" to create it

### Step 5: Build and Run

1. Select an Android Emulator or connected device
2. Click Run (green play button) or Shift+F10
3. App should launch with the demo store UI

## File Structure

```
android-compose-demo/
├── app/
│   ├── build.gradle.kts           # App build config ✓
│   ├── proguard-rules.pro         # ProGuard rules ✓
│   └── src/main/
│       ├── AndroidManifest.xml    # App manifest ✓
│       ├── kotlin/com/mobiledevmcp/demo/
│       │   ├── MainActivity.kt        ✓
│       │   ├── MCPDemoApplication.kt  ✓
│       │   ├── viewmodel/AppViewModel.kt ✓
│       │   └── ui/
│       │       ├── screens/           ✓ (5 screens)
│       │       └── theme/Theme.kt     ✓
│       └── res/values/
│           ├── strings.xml        ✓
│           └── themes.xml         ✓
├── build.gradle.kts              # Root build config ✓
├── settings.gradle.kts           # Settings ✓
├── gradle.properties             # Gradle properties ✓
└── gradle/wrapper/
    └── gradle-wrapper.properties ✓
```

## Testing MCP Integration

1. **Start MCP server:**
   ```bash
   cd ../../packages/mcp-server
   npm run dev
   ```

2. **For Emulator** - localhost works automatically

3. **For Physical Device** - Enable port forwarding:
   ```bash
   adb reverse tcp:8765 tcp:8765
   ```

4. **In Cursor, try:**
   - "What's the app state?"
   - "Show cart items"
   - "List feature flags"

## Troubleshooting

### Gradle sync fails
- Check internet connection
- File → Invalidate Caches / Restart
- Delete `.gradle` folder and re-sync

### Build fails with SDK errors
- Ensure Android SDK 34 is installed
- Tools → SDK Manager → Install missing SDKs

### App crashes on launch
- Check MCP server is running on localhost:8765
- View Logcat for error messages
- Filter by tag "MCP" or "MCPDemoApp"

### Emulator can't connect to localhost
- Emulator uses 10.0.2.2 for host machine
- Update serverUrl in MCPDemoApplication.kt if needed:
  ```kotlin
  MCPBridge.initialize(context = this, serverUrl = "ws://10.0.2.2:8765")
  ```
