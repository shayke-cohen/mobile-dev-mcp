#!/bin/bash
# Run iOS SwiftUI Demo App on Simulator

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_DIR="$PROJECT_ROOT/examples/ios-swiftui-demo"

echo "🍎 iOS SwiftUI Demo Runner"
echo "=========================="

# Check for Xcode
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode is not installed. Please install Xcode from the App Store."
    exit 1
fi

# Check for simulator
SIMULATOR_NAME="${1:-iPhone 15}"
echo "📱 Looking for simulator: $SIMULATOR_NAME"

DEVICE_ID=$(xcrun simctl list devices available -j | \
    python3 -c "import sys,json; devices=json.load(sys.stdin)['devices']; \
    [print(d['udid']) for runtime in devices.values() for d in runtime if '$SIMULATOR_NAME' in d['name'] and d['isAvailable']]" 2>/dev/null | head -1)

if [ -z "$DEVICE_ID" ]; then
    echo "❌ Simulator '$SIMULATOR_NAME' not found. Available simulators:"
    xcrun simctl list devices available | grep -E "iPhone|iPad" | head -10
    echo ""
    echo "Usage: $0 [simulator-name]"
    echo "Example: $0 'iPhone 15 Pro'"
    exit 1
fi

echo "✅ Found simulator: $DEVICE_ID"

# Boot simulator if needed
DEVICE_STATE=$(xcrun simctl list devices -j | python3 -c "import sys,json; devices=json.load(sys.stdin)['devices']; \
    [print(d['state']) for runtime in devices.values() for d in runtime if d['udid']=='$DEVICE_ID']" 2>/dev/null | head -1)

if [ "$DEVICE_STATE" != "Booted" ]; then
    echo "🚀 Booting simulator..."
    xcrun simctl boot "$DEVICE_ID" 2>/dev/null || true
    open -a Simulator
    sleep 3
fi

# Check if the demo project exists with proper Xcode project
if [ ! -d "$APP_DIR/MCPDemo.xcodeproj" ]; then
    echo "📦 Creating Xcode project structure..."
    
    # Create Xcode project
    mkdir -p "$APP_DIR/MCPDemo.xcodeproj"
    
    cat > "$APP_DIR/MCPDemo.xcodeproj/project.pbxproj" << 'PBXPROJ'
// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 56;
	objects = {

/* Begin PBXBuildFile section */
		001 /* MCPDemoApp.swift */ = {isa = PBXBuildFile; fileRef = 002; };
		003 /* ContentView.swift */ = {isa = PBXBuildFile; fileRef = 004; };
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
		002 /* MCPDemoApp.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MCPDemoApp.swift; sourceTree = "<group>"; };
		004 /* ContentView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ContentView.swift; sourceTree = "<group>"; };
		005 /* MCPDemo.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = MCPDemo.app; sourceTree = BUILT_PRODUCTS_DIR; };
/* End PBXFileReference section */

/* Begin PBXGroup section */
		006 = {
			isa = PBXGroup;
			children = (
				007 /* Sources */,
				008 /* Products */,
			);
			sourceTree = "<group>";
		};
		007 /* Sources */ = {
			isa = PBXGroup;
			children = (
				002 /* MCPDemoApp.swift */,
				004 /* ContentView.swift */,
			);
			path = Sources;
			sourceTree = "<group>";
		};
		008 /* Products */ = {
			isa = PBXGroup;
			children = (
				005 /* MCPDemo.app */,
			);
			name = Products;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		009 /* MCPDemo */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = 010;
			buildPhases = (
				011 /* Sources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			name = MCPDemo;
			productName = MCPDemo;
			productReference = 005 /* MCPDemo.app */;
			productType = "com.apple.product-type.application";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		012 /* Project object */ = {
			isa = PBXProject;
			buildConfigurationList = 013;
			compatibilityVersion = "Xcode 14.0";
			mainGroup = 006;
			productRefGroup = 008 /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				009 /* MCPDemo */,
			);
		};
/* End PBXProject section */

/* Begin PBXSourcesBuildPhase section */
		011 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				001 /* MCPDemoApp.swift */,
				003 /* ContentView.swift */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
		014 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = "";
				INFOPLIST_GENERATION_CLASS = SwiftUI;
				INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
				INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
				INFOPLIST_KEY_UILaunchScreen_Generation = YES;
				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = com.mobiledevmcp.demo;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		015 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = "";
				INFOPLIST_GENERATION_CLASS = SwiftUI;
				INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
				INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
				INFOPLIST_KEY_UILaunchScreen_Generation = YES;
				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = com.mobiledevmcp.demo;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Release;
		};
		016 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 16.0;
				SDKROOT = iphoneos;
				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
			};
			name = Debug;
		};
		017 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 16.0;
				SDKROOT = iphoneos;
				SWIFT_OPTIMIZATION_LEVEL = "-O";
			};
			name = Release;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		010 /* Build configuration list for PBXNativeTarget */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				014 /* Debug */,
				015 /* Release */,
			);
			defaultConfigurationName = Release;
		};
		013 /* Build configuration list for PBXProject */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				016 /* Debug */,
				017 /* Release */,
			);
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */

	};
	rootObject = 012 /* Project object */;
}
PBXPROJ

    echo "✅ Xcode project created"
fi

# Build the app
echo "🔨 Building app..."
BUILD_DIR="$APP_DIR/build"
mkdir -p "$BUILD_DIR"

xcodebuild \
    -project "$APP_DIR/MCPDemo.xcodeproj" \
    -scheme MCPDemo \
    -configuration Debug \
    -destination "id=$DEVICE_ID" \
    -derivedDataPath "$BUILD_DIR" \
    build 2>&1 | grep -E "(error:|warning:|BUILD|Compiling)" || true

APP_PATH=$(find "$BUILD_DIR" -name "MCPDemo.app" -type d | head -1)

if [ -z "$APP_PATH" ]; then
    echo "❌ Build failed. Check Xcode for errors."
    echo "💡 Try opening the project in Xcode: open $APP_DIR/MCPDemo.xcodeproj"
    exit 1
fi

echo "✅ Build successful: $APP_PATH"

# Install and launch
echo "📲 Installing app..."
xcrun simctl install "$DEVICE_ID" "$APP_PATH"

echo "🚀 Launching app..."
xcrun simctl launch "$DEVICE_ID" com.mobiledevmcp.demo

echo ""
echo "✅ iOS Demo app is now running!"
echo "📱 Simulator: $SIMULATOR_NAME"
echo "🔗 The app should connect to MCP server at ws://localhost:8765"
