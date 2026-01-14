# App Store Submission Tools - Design Document

## Overview

This document outlines the design for MCP tools that enable AI-assisted app store submission for iOS (App Store / TestFlight) and Android (Google Play Store).

## Design Principles

1. **Security First** - Credentials never logged, stored encrypted, minimal exposure
2. **Progressive Complexity** - Start with builds, add submission later
3. **Leverage Existing Tools** - Integrate with fastlane where sensible
4. **Fail Safe** - Never auto-submit to production without explicit confirmation
5. **Audit Trail** - Log all submission-related actions

---

## Phase 1: Release Build Tools (No Credentials Required)

### Tool: `build_release_ios`

Create a signed iOS release build (IPA).

```typescript
{
  name: 'build_release_ios',
  description: 'Build a signed iOS release IPA for App Store submission',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to iOS project (.xcodeproj or .xcworkspace)'
      },
      scheme: {
        type: 'string',
        description: 'Xcode scheme to build'
      },
      configuration: {
        type: 'string',
        enum: ['Release', 'Debug'],
        default: 'Release'
      },
      exportMethod: {
        type: 'string',
        enum: ['app-store', 'ad-hoc', 'enterprise', 'development'],
        default: 'app-store',
        description: 'Export method for IPA'
      },
      teamId: {
        type: 'string',
        description: 'Apple Developer Team ID (optional, uses default)'
      },
      outputPath: {
        type: 'string',
        description: 'Output directory for IPA (default: ./build)'
      },
      incrementBuild: {
        type: 'boolean',
        default: false,
        description: 'Auto-increment build number'
      }
    },
    required: ['projectPath', 'scheme']
  }
}
```

**Implementation:**
```bash
# 1. Archive
xcodebuild archive \
  -workspace MyApp.xcworkspace \
  -scheme MyApp \
  -configuration Release \
  -archivePath ./build/MyApp.xcarchive

# 2. Export IPA
xcodebuild -exportArchive \
  -archivePath ./build/MyApp.xcarchive \
  -exportPath ./build \
  -exportOptionsPlist ExportOptions.plist
```

**Returns:**
```json
{
  "success": true,
  "ipaPath": "/path/to/MyApp.ipa",
  "archivePath": "/path/to/MyApp.xcarchive",
  "buildNumber": "42",
  "version": "1.2.0",
  "bundleId": "com.example.myapp",
  "size": "45.2 MB",
  "signingIdentity": "Apple Distribution: Company Name (TEAMID)"
}
```

---

### Tool: `build_release_android`

Create a signed Android release build (AAB/APK).

```typescript
{
  name: 'build_release_android',
  description: 'Build a signed Android release bundle for Play Store submission',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to Android project (with build.gradle)'
      },
      buildType: {
        type: 'string',
        enum: ['release', 'debug'],
        default: 'release'
      },
      outputFormat: {
        type: 'string',
        enum: ['aab', 'apk', 'both'],
        default: 'aab',
        description: 'Output format (AAB required for Play Store)'
      },
      flavor: {
        type: 'string',
        description: 'Build flavor (if using product flavors)'
      },
      keystorePath: {
        type: 'string',
        description: 'Path to keystore file (uses gradle.properties if not provided)'
      },
      incrementVersionCode: {
        type: 'boolean',
        default: false,
        description: 'Auto-increment versionCode'
      }
    },
    required: ['projectPath']
  }
}
```

**Implementation:**
```bash
# Build AAB
./gradlew bundleRelease

# Or build APK
./gradlew assembleRelease
```

**Returns:**
```json
{
  "success": true,
  "aabPath": "/path/to/app-release.aab",
  "apkPath": "/path/to/app-release.apk",
  "versionCode": 42,
  "versionName": "1.2.0",
  "applicationId": "com.example.myapp",
  "size": "32.1 MB",
  "minSdk": 24,
  "targetSdk": 34
}
```

---

### Tool: `validate_release_build`

Validate a build before submission.

```typescript
{
  name: 'validate_release_build',
  description: 'Validate a release build for store submission requirements',
  inputSchema: {
    type: 'object',
    properties: {
      buildPath: {
        type: 'string',
        description: 'Path to IPA or AAB file'
      },
      platform: {
        type: 'string',
        enum: ['ios', 'android'],
        description: 'Auto-detected if not provided'
      }
    },
    required: ['buildPath']
  }
}
```

**Returns:**
```json
{
  "valid": true,
  "platform": "ios",
  "checks": [
    { "name": "Code Signing", "passed": true, "details": "Signed with distribution certificate" },
    { "name": "Provisioning Profile", "passed": true, "details": "App Store profile, expires 2025-01-01" },
    { "name": "Bundle ID", "passed": true, "details": "com.example.myapp" },
    { "name": "Minimum OS", "passed": true, "details": "iOS 14.0" },
    { "name": "Required Icons", "passed": true, "details": "All sizes present" },
    { "name": "Privacy Manifest", "passed": true, "details": "NSPrivacyTracking configured" },
    { "name": "Entitlements", "passed": true, "details": "Valid entitlements" }
  ],
  "warnings": [
    { "name": "App Size", "message": "Build is 120MB, consider reducing for faster downloads" }
  ],
  "errors": []
}
```

---

### Tool: `get_app_version_info`

Get current version info from project.

```typescript
{
  name: 'get_app_version_info',
  description: 'Get version and build number from project',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to project'
      },
      platform: {
        type: 'string',
        enum: ['ios', 'android', 'react-native']
      }
    },
    required: ['projectPath']
  }
}
```

**Returns:**
```json
{
  "ios": {
    "version": "1.2.0",
    "buildNumber": "42",
    "bundleId": "com.example.myapp",
    "source": "Info.plist"
  },
  "android": {
    "versionName": "1.2.0",
    "versionCode": 42,
    "applicationId": "com.example.myapp",
    "source": "build.gradle"
  }
}
```

---

### Tool: `set_app_version`

Update version/build numbers.

```typescript
{
  name: 'set_app_version',
  description: 'Update app version and build numbers',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string'
      },
      platform: {
        type: 'string',
        enum: ['ios', 'android', 'both']
      },
      version: {
        type: 'string',
        description: 'Marketing version (e.g., "1.2.0")'
      },
      buildNumber: {
        type: 'integer',
        description: 'Build number / versionCode'
      },
      increment: {
        type: 'string',
        enum: ['major', 'minor', 'patch', 'build'],
        description: 'Auto-increment instead of setting explicit value'
      }
    },
    required: ['projectPath']
  }
}
```

---

## Phase 2: Fastlane Integration

### Tool: `fastlane_init`

Initialize fastlane in a project.

```typescript
{
  name: 'fastlane_init',
  description: 'Initialize fastlane in a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string'
      },
      platform: {
        type: 'string',
        enum: ['ios', 'android', 'cross-platform']
      }
    },
    required: ['projectPath']
  }
}
```

---

### Tool: `fastlane_run`

Run a fastlane lane.

```typescript
{
  name: 'fastlane_run',
  description: 'Run a fastlane lane',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string'
      },
      platform: {
        type: 'string',
        enum: ['ios', 'android']
      },
      lane: {
        type: 'string',
        description: 'Lane name to run (e.g., "beta", "release")'
      },
      options: {
        type: 'object',
        description: 'Lane options as key-value pairs'
      },
      env: {
        type: 'object',
        description: 'Environment variables'
      }
    },
    required: ['projectPath', 'lane']
  }
}
```

**Example:**
```json
{
  "projectPath": "./ios",
  "platform": "ios",
  "lane": "beta",
  "options": {
    "version": "1.2.0",
    "changelog": "Bug fixes and improvements"
  }
}
```

---

### Tool: `fastlane_list_lanes`

List available fastlane lanes.

```typescript
{
  name: 'fastlane_list_lanes',
  description: 'List available fastlane lanes in a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string'
      },
      platform: {
        type: 'string',
        enum: ['ios', 'android']
      }
    },
    required: ['projectPath']
  }
}
```

**Returns:**
```json
{
  "ios": [
    { "name": "beta", "description": "Push a new beta build to TestFlight" },
    { "name": "release", "description": "Push a new release to App Store" },
    { "name": "screenshots", "description": "Generate screenshots" }
  ],
  "android": [
    { "name": "beta", "description": "Push to Play Store internal track" },
    { "name": "release", "description": "Push to Play Store production" }
  ]
}
```

---

### Tool: `fastlane_match`

Manage code signing with fastlane match.

```typescript
{
  name: 'fastlane_match',
  description: 'Sync code signing certificates and profiles with fastlane match',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string'
      },
      type: {
        type: 'string',
        enum: ['development', 'adhoc', 'appstore', 'enterprise'],
        default: 'appstore'
      },
      readonly: {
        type: 'boolean',
        default: true,
        description: 'Only fetch, never create new'
      },
      appIdentifier: {
        type: 'string',
        description: 'Bundle ID (uses project default if not set)'
      }
    },
    required: ['projectPath']
  }
}
```

---

## Phase 3: Direct Store APIs

### Credential Management

Before using direct store APIs, credentials must be configured:

```typescript
{
  name: 'configure_store_credentials',
  description: 'Configure app store credentials (stored encrypted)',
  inputSchema: {
    type: 'object',
    properties: {
      store: {
        type: 'string',
        enum: ['apple', 'google']
      },
      // Apple App Store Connect
      appleKeyId: {
        type: 'string',
        description: 'App Store Connect API Key ID'
      },
      appleIssuerId: {
        type: 'string',
        description: 'App Store Connect Issuer ID'
      },
      appleKeyPath: {
        type: 'string',
        description: 'Path to .p8 private key file'
      },
      // Google Play
      googleServiceAccountPath: {
        type: 'string',
        description: 'Path to Google Play service account JSON'
      }
    },
    required: ['store']
  }
}
```

**Security:**
- Credentials stored in system keychain (macOS) or encrypted file
- Never logged or exposed in responses
- Optional: require confirmation for sensitive operations

---

### Tool: `upload_to_testflight`

Upload build to TestFlight.

```typescript
{
  name: 'upload_to_testflight',
  description: 'Upload an iOS build to TestFlight',
  inputSchema: {
    type: 'object',
    properties: {
      ipaPath: {
        type: 'string',
        description: 'Path to IPA file'
      },
      changelog: {
        type: 'string',
        description: 'What\'s new in this build'
      },
      distributeExternal: {
        type: 'boolean',
        default: false,
        description: 'Distribute to external testers'
      },
      groups: {
        type: 'array',
        items: { type: 'string' },
        description: 'Beta tester groups to notify'
      },
      waitForProcessing: {
        type: 'boolean',
        default: true,
        description: 'Wait for App Store processing to complete'
      }
    },
    required: ['ipaPath']
  }
}
```

**Implementation:**
```bash
# Using altool (legacy)
xcrun altool --upload-app -f MyApp.ipa -t ios -u $APPLE_ID -p $APP_SPECIFIC_PASSWORD

# Using notarytool + App Store Connect API (modern)
xcrun notarytool submit MyApp.ipa --key $KEY_PATH --key-id $KEY_ID --issuer $ISSUER_ID
```

**Returns:**
```json
{
  "success": true,
  "buildId": "12345678",
  "version": "1.2.0",
  "buildNumber": "42",
  "status": "processing",
  "estimatedProcessingTime": "15-30 minutes",
  "testFlightUrl": "https://appstoreconnect.apple.com/apps/123456/testflight"
}
```

---

### Tool: `upload_to_play_store`

Upload build to Google Play Store.

```typescript
{
  name: 'upload_to_play_store',
  description: 'Upload an Android build to Google Play Store',
  inputSchema: {
    type: 'object',
    properties: {
      aabPath: {
        type: 'string',
        description: 'Path to AAB file'
      },
      track: {
        type: 'string',
        enum: ['internal', 'alpha', 'beta', 'production'],
        default: 'internal',
        description: 'Release track'
      },
      releaseNotes: {
        type: 'object',
        description: 'Release notes per language',
        additionalProperties: { type: 'string' }
      },
      rolloutPercentage: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Staged rollout percentage (production only)'
      },
      status: {
        type: 'string',
        enum: ['draft', 'completed', 'halted'],
        default: 'completed'
      }
    },
    required: ['aabPath']
  }
}
```

**Returns:**
```json
{
  "success": true,
  "versionCode": 42,
  "track": "internal",
  "status": "completed",
  "reviewStatus": "pending",
  "playConsoleUrl": "https://play.google.com/console/developers/app/123456"
}
```

---

### Tool: `get_app_store_status`

Check app status in stores.

```typescript
{
  name: 'get_app_store_status',
  description: 'Get app status from App Store Connect or Play Console',
  inputSchema: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['ios', 'android']
      },
      appId: {
        type: 'string',
        description: 'App ID / Bundle ID / Application ID'
      }
    },
    required: ['platform', 'appId']
  }
}
```

**Returns (iOS):**
```json
{
  "platform": "ios",
  "appName": "My App",
  "bundleId": "com.example.myapp",
  "liveVersion": {
    "version": "1.1.0",
    "state": "READY_FOR_SALE",
    "releaseDate": "2024-01-01"
  },
  "pendingVersion": {
    "version": "1.2.0",
    "buildNumber": "42",
    "state": "WAITING_FOR_REVIEW",
    "submittedDate": "2024-01-10"
  },
  "testFlightBuilds": [
    { "version": "1.2.0", "build": "43", "status": "PROCESSING" },
    { "version": "1.2.0", "build": "42", "status": "ACTIVE", "externalTesters": 150 }
  ]
}
```

---

### Tool: `submit_for_review`

Submit app for App Store / Play Store review.

```typescript
{
  name: 'submit_for_review',
  description: 'Submit app version for store review',
  inputSchema: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['ios', 'android']
      },
      appId: {
        type: 'string'
      },
      version: {
        type: 'string',
        description: 'Version to submit'
      },
      // iOS specific
      releaseType: {
        type: 'string',
        enum: ['manual', 'after_approval', 'scheduled'],
        default: 'after_approval'
      },
      scheduledReleaseDate: {
        type: 'string',
        format: 'date-time',
        description: 'For scheduled release'
      },
      phasedRelease: {
        type: 'boolean',
        default: false,
        description: 'Enable phased release (iOS)'
      },
      // Android specific
      rolloutPercentage: {
        type: 'number',
        description: 'Initial rollout percentage (Android)'
      }
    },
    required: ['platform', 'appId', 'version']
  }
}
```

⚠️ **Safety:** This tool requires explicit confirmation before executing.

---

### Tool: `update_store_listing`

Update app store metadata.

```typescript
{
  name: 'update_store_listing',
  description: 'Update app store listing metadata',
  inputSchema: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['ios', 'android']
      },
      appId: {
        type: 'string'
      },
      locale: {
        type: 'string',
        default: 'en-US'
      },
      name: {
        type: 'string',
        maxLength: 30
      },
      subtitle: {
        type: 'string',
        maxLength: 30,
        description: 'iOS only'
      },
      description: {
        type: 'string',
        maxLength: 4000
      },
      whatsNew: {
        type: 'string',
        maxLength: 4000
      },
      keywords: {
        type: 'string',
        description: 'iOS: comma-separated, max 100 chars'
      },
      promotionalText: {
        type: 'string',
        maxLength: 170
      },
      supportUrl: {
        type: 'string',
        format: 'uri'
      },
      marketingUrl: {
        type: 'string',
        format: 'uri'
      },
      privacyPolicyUrl: {
        type: 'string',
        format: 'uri'
      }
    },
    required: ['platform', 'appId']
  }
}
```

---

## Security Architecture

### Credential Storage

```
┌─────────────────────────────────────────────────┐
│                MCP Server                        │
│                                                  │
│  ┌─────────────────┐    ┌─────────────────────┐ │
│  │  Credential     │    │  Store API Client   │ │
│  │  Manager        │───►│  (Apple/Google)     │ │
│  └────────┬────────┘    └─────────────────────┘ │
│           │                                      │
└───────────┼──────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │   Keychain    │  (macOS Keychain / encrypted file)
    │   Storage     │
    └───────────────┘
```

### Credential Flow

1. User runs `configure_store_credentials` once
2. Credentials stored in keychain with service name `mobile-dev-mcp`
3. On tool execution, credentials retrieved from keychain
4. Credentials never appear in logs, responses, or error messages
5. Optional: Require Touch ID / password for credential access

### Safety Measures

| Action | Safety Level | Confirmation Required |
|--------|--------------|----------------------|
| Build release | 🟢 Low | No |
| Upload to TestFlight/Internal | 🟡 Medium | No |
| Upload to Beta/External | 🟡 Medium | Optional |
| Submit for review | 🔴 High | **Yes** |
| Release to production | 🔴 High | **Yes** |
| Update store listing | 🟡 Medium | Optional |

---

## Implementation Phases

### Phase 1: Build Tools (Week 1-2)
- [ ] `build_release_ios`
- [ ] `build_release_android`
- [ ] `validate_release_build`
- [ ] `get_app_version_info`
- [ ] `set_app_version`

### Phase 2: Fastlane Integration (Week 3-4)
- [ ] `fastlane_init`
- [ ] `fastlane_run`
- [ ] `fastlane_list_lanes`
- [ ] `fastlane_match`

### Phase 3: Direct Store APIs (Week 5-8)
- [ ] `configure_store_credentials`
- [ ] Credential manager with keychain storage
- [ ] `upload_to_testflight`
- [ ] `upload_to_play_store`
- [ ] `get_app_store_status`
- [ ] `submit_for_review`
- [ ] `update_store_listing`

---

## Example Workflows

### AI-Assisted Beta Release (iOS)

```
User: "Build and upload version 1.2.0 to TestFlight"

AI Actions:
1. get_app_version_info → Current: 1.1.0 (build 41)
2. set_app_version → Set to 1.2.0 (build 42)
3. build_release_ios → Creates MyApp.ipa
4. validate_release_build → All checks passed
5. upload_to_testflight → Upload successful, processing...
6. get_app_store_status → Build ready for testing

AI Response: "Done! Version 1.2.0 (42) is now available on TestFlight."
```

### AI-Assisted Production Release (Android)

```
User: "Release the current build to production with 10% rollout"

AI Actions:
1. get_app_store_status → Build 42 in beta, 0 crashes, 4.8 rating
2. AI: "Build 42 has been in beta for 5 days with good metrics. 
        Proceed with 10% production rollout?"
3. User: "Yes"
4. upload_to_play_store → track: production, rollout: 10%
5. AI: "Released! Monitoring enabled. I'll alert you if crash rate exceeds 1%."
```

---

## Open Questions

1. **Credential storage on non-macOS systems?**
   - Option A: Encrypted file with user-provided password
   - Option B: Environment variables
   - Option C: Integration with 1Password/other managers

2. **Should we support screenshot upload?**
   - Complex due to device-specific requirements
   - Could integrate with fastlane snapshot/screengrab

3. **Multi-app support?**
   - Store credentials per app ID or global?
   - Workspace-level configuration?

4. **CI/CD integration?**
   - Should tools work in headless CI environments?
   - Different credential storage for CI?

---

## Feedback Requested

Please review and provide feedback on:

1. ✅ Tool definitions and parameters
2. ✅ Security approach
3. ✅ Implementation phases
4. ✅ Missing features
5. ✅ Naming conventions
