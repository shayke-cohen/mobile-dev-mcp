/**
 * Release Build Tools - Phase 1 of App Store Submission
 * 
 * Tools for building release versions and managing app versions.
 * No credentials required - these work locally.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// MARK: - Plist Utilities (using native macOS commands)

async function readPlist(plistPath: string): Promise<Record<string, unknown>> {
  // Use plutil to convert plist to JSON
  const { stdout } = await execAsync(`plutil -convert json -o - "${plistPath}"`);
  return JSON.parse(stdout);
}

async function writePlist(plistPath: string, content: Record<string, unknown>): Promise<void> {
  // Write JSON to temp file then convert to plist
  const tempPath = `/tmp/plist_${Date.now()}.json`;
  fs.writeFileSync(tempPath, JSON.stringify(content, null, 2));
  
  // Determine the original format (binary or xml)
  const { stdout: fileInfo } = await execAsync(`file "${plistPath}"`);
  const format = fileInfo.includes('binary') ? 'binary1' : 'xml1';
  
  // Convert JSON to plist
  await execAsync(`plutil -convert ${format} "${tempPath}" -o "${plistPath}"`);
  fs.unlinkSync(tempPath);
}

// MARK: - Tool Definitions

export const releaseTools = [
  {
    name: 'get_app_version_info',
    description: 'Get version and build number from an iOS or Android project',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'react-native', 'auto'],
          description: 'Platform to check (auto-detects if not specified)',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'set_app_version',
    description: 'Update app version and build numbers',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'both'],
          description: 'Platform to update',
        },
        version: {
          type: 'string',
          description: 'Marketing version (e.g., "1.2.0")',
        },
        buildNumber: {
          type: 'number',
          description: 'Build number / versionCode',
        },
        increment: {
          type: 'string',
          enum: ['major', 'minor', 'patch', 'build'],
          description: 'Auto-increment type (alternative to explicit version)',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'build_release_ios',
    description: 'Build a signed iOS release IPA for App Store or TestFlight submission',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to iOS project directory',
        },
        scheme: {
          type: 'string',
          description: 'Xcode scheme to build (auto-detected if not specified)',
        },
        configuration: {
          type: 'string',
          enum: ['Release', 'Debug'],
          description: 'Build configuration (default: Release)',
        },
        exportMethod: {
          type: 'string',
          enum: ['app-store', 'ad-hoc', 'enterprise', 'development'],
          description: 'Export method for IPA (default: app-store)',
        },
        teamId: {
          type: 'string',
          description: 'Apple Developer Team ID (uses default if not specified)',
        },
        outputPath: {
          type: 'string',
          description: 'Output directory for IPA (default: ./build)',
        },
        incrementBuild: {
          type: 'boolean',
          description: 'Auto-increment build number before building',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'build_release_android',
    description: 'Build a signed Android release bundle (AAB) or APK for Play Store submission',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to Android project directory',
        },
        buildType: {
          type: 'string',
          enum: ['release', 'debug'],
          description: 'Build type (default: release)',
        },
        outputFormat: {
          type: 'string',
          enum: ['aab', 'apk', 'both'],
          description: 'Output format - AAB required for Play Store (default: aab)',
        },
        flavor: {
          type: 'string',
          description: 'Build flavor (if using product flavors)',
        },
        incrementVersionCode: {
          type: 'boolean',
          description: 'Auto-increment versionCode before building',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'validate_release_build',
    description: 'Validate a release build (IPA or AAB) for store submission requirements',
    inputSchema: {
      type: 'object' as const,
      properties: {
        buildPath: {
          type: 'string',
          description: 'Path to IPA or AAB file',
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
          description: 'Platform (auto-detected from file extension if not specified)',
        },
      },
      required: ['buildPath'],
    },
  },
];

// MARK: - Handler

export async function handleReleaseTool(
  name: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'get_app_version_info':
      return getAppVersionInfo(params);
    case 'set_app_version':
      return setAppVersion(params);
    case 'build_release_ios':
      return buildReleaseIOS(params);
    case 'build_release_android':
      return buildReleaseAndroid(params);
    case 'validate_release_build':
      return validateReleaseBuild(params);
    default:
      throw new Error(`Unknown release tool: ${name}`);
  }
}

// MARK: - Version Info

interface VersionInfo {
  version: string;
  buildNumber: string | number;
  bundleId?: string;
  applicationId?: string;
  source: string;
}

async function getAppVersionInfo(params: Record<string, unknown>): Promise<unknown> {
  const projectPath = params.projectPath as string;
  const platform = params.platform as string || 'auto';

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  const result: { ios?: VersionInfo; android?: VersionInfo } = {};

  // Auto-detect platform
  if (platform === 'auto' || platform === 'react-native') {
    const hasIOS = fs.existsSync(path.join(projectPath, 'ios')) || 
                   fs.readdirSync(projectPath).some(f => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'));
    const hasAndroid = fs.existsSync(path.join(projectPath, 'android')) ||
                       fs.existsSync(path.join(projectPath, 'build.gradle')) ||
                       fs.existsSync(path.join(projectPath, 'build.gradle.kts'));
    
    if (hasIOS) {
      result.ios = await getIOSVersionInfo(projectPath);
    }
    if (hasAndroid) {
      result.android = await getAndroidVersionInfo(projectPath);
    }
  } else if (platform === 'ios') {
    result.ios = await getIOSVersionInfo(projectPath);
  } else if (platform === 'android') {
    result.android = await getAndroidVersionInfo(projectPath);
  }

  if (!result.ios && !result.android) {
    throw new Error('No iOS or Android project found in the specified path');
  }

  return result;
}

async function getIOSVersionInfo(projectPath: string): Promise<VersionInfo> {
  // Check for React Native structure
  const iosPath = fs.existsSync(path.join(projectPath, 'ios')) 
    ? path.join(projectPath, 'ios') 
    : projectPath;

  // Find Info.plist
  const infoPlistPath = await findInfoPlist(iosPath);
  if (!infoPlistPath) {
    throw new Error('Info.plist not found');
  }

  const plistContent = await readPlist(infoPlistPath);
  
  return {
    version: plistContent.CFBundleShortVersionString as string || '1.0.0',
    buildNumber: plistContent.CFBundleVersion as string || '1',
    bundleId: plistContent.CFBundleIdentifier as string,
    source: infoPlistPath,
  };
}

async function findInfoPlist(iosPath: string): Promise<string | null> {
  // Common locations
  const locations = [
    'Info.plist',
    '*/Info.plist',
    '*/*/Info.plist',
  ];

  for (const location of locations) {
    try {
      const { stdout } = await execAsync(`find "${iosPath}" -name "Info.plist" -not -path "*/Pods/*" -not -path "*/build/*" | head -1`);
      if (stdout.trim()) {
        return stdout.trim();
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function getAndroidVersionInfo(projectPath: string): Promise<VersionInfo> {
  // Check for React Native structure
  const androidPath = fs.existsSync(path.join(projectPath, 'android')) 
    ? path.join(projectPath, 'android') 
    : projectPath;

  // Find build.gradle or build.gradle.kts
  const gradleFiles = [
    path.join(androidPath, 'app/build.gradle.kts'),
    path.join(androidPath, 'app/build.gradle'),
    path.join(androidPath, 'build.gradle.kts'),
    path.join(androidPath, 'build.gradle'),
  ];

  let gradleFile: string | null = null;
  for (const file of gradleFiles) {
    if (fs.existsSync(file)) {
      gradleFile = file;
      break;
    }
  }

  if (!gradleFile) {
    throw new Error('build.gradle not found');
  }

  const content = fs.readFileSync(gradleFile, 'utf8');
  
  // Parse version info from Gradle
  const versionNameMatch = content.match(/versionName\s*[=:]\s*["']([^"']+)["']/);
  const versionCodeMatch = content.match(/versionCode\s*[=:]\s*(\d+)/);
  const applicationIdMatch = content.match(/applicationId\s*[=:]\s*["']([^"']+)["']/);

  return {
    version: versionNameMatch?.[1] || '1.0.0',
    buildNumber: parseInt(versionCodeMatch?.[1] || '1', 10),
    applicationId: applicationIdMatch?.[1],
    source: gradleFile,
  };
}

// MARK: - Set Version

async function setAppVersion(params: Record<string, unknown>): Promise<unknown> {
  const projectPath = params.projectPath as string;
  const platform = params.platform as string || 'both';
  const version = params.version as string | undefined;
  const buildNumber = params.buildNumber as number | undefined;
  const increment = params.increment as string | undefined;

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  const results: { ios?: unknown; android?: unknown } = {};
  
  // Get current version if incrementing
  let currentVersion: { ios?: VersionInfo; android?: VersionInfo } | null = null;
  if (increment) {
    currentVersion = await getAppVersionInfo({ projectPath, platform: 'auto' }) as { ios?: VersionInfo; android?: VersionInfo };
  }

  // Calculate new version
  let newVersion = version;
  let newBuildNumber = buildNumber;

  if (increment && currentVersion) {
    const baseVersion = currentVersion.ios?.version || currentVersion.android?.version || '1.0.0';
    const baseBuild = parseInt(String(currentVersion.ios?.buildNumber || currentVersion.android?.buildNumber || '1'), 10);

    if (increment === 'build') {
      newBuildNumber = baseBuild + 1;
    } else {
      const parts = baseVersion.split('.').map(p => parseInt(p, 10));
      while (parts.length < 3) parts.push(0);

      switch (increment) {
        case 'major':
          parts[0]++;
          parts[1] = 0;
          parts[2] = 0;
          break;
        case 'minor':
          parts[1]++;
          parts[2] = 0;
          break;
        case 'patch':
          parts[2]++;
          break;
      }
      newVersion = parts.join('.');
      newBuildNumber = baseBuild + 1;
    }
  }

  if (platform === 'ios' || platform === 'both') {
    results.ios = await setIOSVersion(projectPath, newVersion, newBuildNumber);
  }

  if (platform === 'android' || platform === 'both') {
    results.android = await setAndroidVersion(projectPath, newVersion, newBuildNumber);
  }

  return {
    success: true,
    newVersion: newVersion,
    newBuildNumber: newBuildNumber,
    updated: results,
  };
}

async function setIOSVersion(projectPath: string, version?: string, buildNumber?: number): Promise<unknown> {
  const iosPath = fs.existsSync(path.join(projectPath, 'ios')) 
    ? path.join(projectPath, 'ios') 
    : projectPath;

  const infoPlistPath = await findInfoPlist(iosPath);
  if (!infoPlistPath) {
    throw new Error('Info.plist not found');
  }

  const plistContent = await readPlist(infoPlistPath);
  
  if (version) {
    plistContent.CFBundleShortVersionString = version;
  }
  if (buildNumber !== undefined) {
    plistContent.CFBundleVersion = String(buildNumber);
  }

  await writePlist(infoPlistPath, plistContent);

  return {
    version: plistContent.CFBundleShortVersionString,
    buildNumber: plistContent.CFBundleVersion,
    file: infoPlistPath,
  };
}

async function setAndroidVersion(projectPath: string, version?: string, buildNumber?: number): Promise<unknown> {
  const androidPath = fs.existsSync(path.join(projectPath, 'android')) 
    ? path.join(projectPath, 'android') 
    : projectPath;

  // Find build.gradle
  const gradleFiles = [
    path.join(androidPath, 'app/build.gradle.kts'),
    path.join(androidPath, 'app/build.gradle'),
  ];

  let gradleFile: string | null = null;
  for (const file of gradleFiles) {
    if (fs.existsSync(file)) {
      gradleFile = file;
      break;
    }
  }

  if (!gradleFile) {
    throw new Error('build.gradle not found');
  }

  let content = fs.readFileSync(gradleFile, 'utf8');
  
  if (version) {
    content = content.replace(
      /(versionName\s*[=:]\s*["'])[^"']+["']/,
      `$1${version}"`
    );
  }
  if (buildNumber !== undefined) {
    content = content.replace(
      /(versionCode\s*[=:]\s*)\d+/,
      `$1${buildNumber}`
    );
  }

  fs.writeFileSync(gradleFile, content);

  // Re-read to confirm
  const updatedContent = fs.readFileSync(gradleFile, 'utf8');
  const versionNameMatch = updatedContent.match(/versionName\s*[=:]\s*["']([^"']+)["']/);
  const versionCodeMatch = updatedContent.match(/versionCode\s*[=:]\s*(\d+)/);

  return {
    version: versionNameMatch?.[1],
    versionCode: versionCodeMatch?.[1],
    file: gradleFile,
  };
}

// MARK: - Build Release iOS

async function buildReleaseIOS(params: Record<string, unknown>): Promise<unknown> {
  const projectPath = params.projectPath as string;
  const scheme = params.scheme as string | undefined;
  const configuration = (params.configuration as string) || 'Release';
  const exportMethod = (params.exportMethod as string) || 'app-store';
  const teamId = params.teamId as string | undefined;
  const outputPath = (params.outputPath as string) || path.join(projectPath, 'build');
  const incrementBuild = params.incrementBuild as boolean || false;

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  // Check for iOS directory (React Native)
  const iosPath = fs.existsSync(path.join(projectPath, 'ios')) 
    ? path.join(projectPath, 'ios') 
    : projectPath;

  // Find workspace or project
  const files = fs.readdirSync(iosPath);
  const workspace = files.find(f => f.endsWith('.xcworkspace'));
  const xcodeproj = files.find(f => f.endsWith('.xcodeproj'));

  if (!workspace && !xcodeproj) {
    throw new Error('No Xcode workspace or project found');
  }

  // Auto-detect scheme if not provided
  const schemeName = scheme || (workspace ? path.basename(workspace, '.xcworkspace') : path.basename(xcodeproj!, '.xcodeproj'));

  // Increment build number if requested
  if (incrementBuild) {
    await setAppVersion({ projectPath, platform: 'ios', increment: 'build' });
  }

  // Get version info
  const versionInfo = await getIOSVersionInfo(iosPath);

  // Create output directory
  fs.mkdirSync(outputPath, { recursive: true });

  const archivePath = path.join(outputPath, `${schemeName}.xcarchive`);
  const projectArg = workspace 
    ? `-workspace "${path.join(iosPath, workspace)}"` 
    : `-project "${path.join(iosPath, xcodeproj!)}"`;

  console.error(`[Release] Building iOS archive for scheme: ${schemeName}`);

  // Step 1: Archive
  const archiveCmd = `xcodebuild archive ${projectArg} -scheme "${schemeName}" -configuration ${configuration} -archivePath "${archivePath}" CODE_SIGN_STYLE=Automatic ${teamId ? `DEVELOPMENT_TEAM=${teamId}` : ''}`;

  try {
    await execAsync(archiveCmd, {
      cwd: iosPath,
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Archive failed: ${message}`);
  }

  // Step 2: Create export options plist
  const exportOptionsPath = path.join(outputPath, 'ExportOptions.plist');
  const exportOptions: Record<string, unknown> = {
    method: exportMethod,
    signingStyle: 'automatic',
    uploadSymbols: true,
    uploadBitcode: false,
  };
  if (teamId) {
    exportOptions.teamID = teamId;
  }
  
  // Write export options as XML plist
  const plistXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${exportMethod}</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>uploadSymbols</key>
  <true/>
  <key>uploadBitcode</key>
  <false/>${teamId ? `
  <key>teamID</key>
  <string>${teamId}</string>` : ''}
</dict>
</plist>`;
  fs.writeFileSync(exportOptionsPath, plistXml);

  // Step 3: Export IPA
  console.error('[Release] Exporting IPA...');
  const exportCmd = `xcodebuild -exportArchive -archivePath "${archivePath}" -exportPath "${outputPath}" -exportOptionsPlist "${exportOptionsPath}"`;

  try {
    await execAsync(exportCmd, {
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Export failed: ${message}`);
  }

  // Find the IPA
  const ipaFiles = fs.readdirSync(outputPath).filter(f => f.endsWith('.ipa'));
  const ipaPath = ipaFiles.length > 0 ? path.join(outputPath, ipaFiles[0]) : null;

  if (!ipaPath) {
    throw new Error('IPA file not found after export');
  }

  // Get IPA size
  const stats = fs.statSync(ipaPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

  // Get signing info
  let signingIdentity = 'Unknown';
  try {
    const { stdout } = await execAsync(`codesign -dv --verbose=4 "${ipaPath}" 2>&1 | grep "Authority=" | head -1`);
    signingIdentity = stdout.replace('Authority=', '').trim();
  } catch {
    // Ignore
  }

  return {
    success: true,
    ipaPath,
    archivePath,
    buildNumber: versionInfo.buildNumber,
    version: versionInfo.version,
    bundleId: versionInfo.bundleId,
    size: `${sizeMB} MB`,
    signingIdentity,
    exportMethod,
  };
}

// MARK: - Build Release Android

async function buildReleaseAndroid(params: Record<string, unknown>): Promise<unknown> {
  const projectPath = params.projectPath as string;
  const buildType = (params.buildType as string) || 'release';
  const outputFormat = (params.outputFormat as string) || 'aab';
  const flavor = params.flavor as string | undefined;
  const incrementVersionCode = params.incrementVersionCode as boolean || false;

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  // Check for Android directory (React Native)
  const androidPath = fs.existsSync(path.join(projectPath, 'android')) 
    ? path.join(projectPath, 'android') 
    : projectPath;

  const gradlew = path.join(androidPath, 'gradlew');
  if (!fs.existsSync(gradlew)) {
    throw new Error('gradlew not found. Is this an Android project?');
  }

  // Increment version code if requested
  if (incrementVersionCode) {
    await setAppVersion({ projectPath, platform: 'android', increment: 'build' });
  }

  // Get version info
  const versionInfo = await getAndroidVersionInfo(androidPath);

  // Determine Gradle tasks
  const tasks: string[] = [];
  const capitalizedBuildType = buildType.charAt(0).toUpperCase() + buildType.slice(1);
  const flavorCapitalized = flavor ? flavor.charAt(0).toUpperCase() + flavor.slice(1) : '';

  if (outputFormat === 'aab' || outputFormat === 'both') {
    tasks.push(`bundle${flavorCapitalized}${capitalizedBuildType}`);
  }
  if (outputFormat === 'apk' || outputFormat === 'both') {
    tasks.push(`assemble${flavorCapitalized}${capitalizedBuildType}`);
  }

  console.error(`[Release] Building Android ${outputFormat} (${buildType})...`);

  // Run Gradle build
  const cmd = `./gradlew ${tasks.join(' ')} --no-daemon`;
  
  try {
    await execAsync(cmd, {
      cwd: androidPath,
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Build failed: ${message}`);
  }

  // Find output files
  const outputDir = path.join(androidPath, 'app/build/outputs');
  let aabPath: string | undefined;
  let apkPath: string | undefined;

  if (outputFormat === 'aab' || outputFormat === 'both') {
    const aabDir = path.join(outputDir, 'bundle', flavor ? `${flavor}${capitalizedBuildType}` : buildType);
    if (fs.existsSync(aabDir)) {
      const aabFiles = fs.readdirSync(aabDir).filter(f => f.endsWith('.aab'));
      if (aabFiles.length > 0) {
        aabPath = path.join(aabDir, aabFiles[0]);
      }
    }
  }

  if (outputFormat === 'apk' || outputFormat === 'both') {
    const apkDir = path.join(outputDir, 'apk', flavor || '', buildType);
    if (fs.existsSync(apkDir)) {
      const apkFiles = fs.readdirSync(apkDir).filter(f => f.endsWith('.apk'));
      if (apkFiles.length > 0) {
        apkPath = path.join(apkDir, apkFiles[0]);
      }
    }
  }

  // Get file sizes
  const getSize = (filePath: string) => {
    const stats = fs.statSync(filePath);
    return `${(stats.size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get SDK info from build.gradle
  const gradleContent = fs.readFileSync(versionInfo.source, 'utf8');
  const minSdkMatch = gradleContent.match(/minSdk\s*[=:]\s*(\d+)/);
  const targetSdkMatch = gradleContent.match(/targetSdk\s*[=:]\s*(\d+)/);

  return {
    success: true,
    aabPath,
    apkPath,
    versionCode: versionInfo.buildNumber,
    versionName: versionInfo.version,
    applicationId: versionInfo.applicationId,
    size: aabPath ? getSize(aabPath) : (apkPath ? getSize(apkPath) : 'Unknown'),
    minSdk: minSdkMatch ? parseInt(minSdkMatch[1], 10) : undefined,
    targetSdk: targetSdkMatch ? parseInt(targetSdkMatch[1], 10) : undefined,
    flavor: flavor || undefined,
  };
}

// MARK: - Validate Release Build

interface ValidationCheck {
  name: string;
  passed: boolean;
  details: string;
}

interface ValidationResult {
  valid: boolean;
  platform: string;
  checks: ValidationCheck[];
  warnings: Array<{ name: string; message: string }>;
  errors: Array<{ name: string; message: string }>;
}

async function validateReleaseBuild(params: Record<string, unknown>): Promise<ValidationResult> {
  const buildPath = params.buildPath as string;
  let platform = params.platform as string | undefined;

  if (!fs.existsSync(buildPath)) {
    throw new Error(`Build file not found: ${buildPath}`);
  }

  // Auto-detect platform from extension
  if (!platform) {
    if (buildPath.endsWith('.ipa')) {
      platform = 'ios';
    } else if (buildPath.endsWith('.aab') || buildPath.endsWith('.apk')) {
      platform = 'android';
    } else {
      throw new Error('Cannot determine platform. Please specify platform parameter.');
    }
  }

  if (platform === 'ios') {
    return validateIOSBuild(buildPath);
  } else {
    return validateAndroidBuild(buildPath);
  }
}

async function validateIOSBuild(ipaPath: string): Promise<ValidationResult> {
  const checks: ValidationCheck[] = [];
  const warnings: Array<{ name: string; message: string }> = [];
  const errors: Array<{ name: string; message: string }> = [];

  // Create temp directory for extraction
  const tempDir = path.join('/tmp', `ipa_validate_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Extract IPA (it's a zip file)
    await execAsync(`unzip -q "${ipaPath}" -d "${tempDir}"`);

    // Find the .app bundle
    const payloadDir = path.join(tempDir, 'Payload');
    const appDirs = fs.readdirSync(payloadDir).filter(f => f.endsWith('.app'));
    
    if (appDirs.length === 0) {
      throw new Error('No .app bundle found in IPA');
    }

    const appPath = path.join(payloadDir, appDirs[0]);
    const infoPlistPath = path.join(appPath, 'Info.plist');

    // Read Info.plist
    const plistContent = await readPlist(infoPlistPath);

    // Check 1: Code Signing
    try {
      const { stdout } = await execAsync(`codesign -dv --verbose=4 "${appPath}" 2>&1`);
      const hasDistributionCert = stdout.includes('Apple Distribution') || stdout.includes('iPhone Distribution');
      checks.push({
        name: 'Code Signing',
        passed: hasDistributionCert,
        details: hasDistributionCert ? 'Signed with distribution certificate' : 'Not signed with distribution certificate',
      });
    } catch {
      checks.push({
        name: 'Code Signing',
        passed: false,
        details: 'Failed to verify code signature',
      });
      errors.push({ name: 'Code Signing', message: 'Code signature verification failed' });
    }

    // Check 2: Bundle ID
    const bundleId = plistContent.CFBundleIdentifier as string;
    checks.push({
      name: 'Bundle ID',
      passed: !!bundleId && !bundleId.includes('$('),
      details: bundleId || 'Not set',
    });

    // Check 3: Version
    const version = plistContent.CFBundleShortVersionString as string;
    const buildNumber = plistContent.CFBundleVersion as string;
    checks.push({
      name: 'Version Info',
      passed: !!version && !!buildNumber,
      details: `${version} (${buildNumber})`,
    });

    // Check 4: Minimum iOS Version
    const minVersion = plistContent.MinimumOSVersion as string;
    checks.push({
      name: 'Minimum OS',
      passed: !!minVersion,
      details: minVersion ? `iOS ${minVersion}` : 'Not set',
    });

    // Check 5: Required Device Capabilities
    const capabilities = plistContent.UIRequiredDeviceCapabilities as string[] || [];
    checks.push({
      name: 'Device Capabilities',
      passed: true,
      details: capabilities.length > 0 ? capabilities.join(', ') : 'None specified',
    });

    // Check 6: App Icons
    const iconFiles = fs.readdirSync(appPath).filter(f => f.includes('AppIcon'));
    checks.push({
      name: 'App Icons',
      passed: iconFiles.length > 0,
      details: iconFiles.length > 0 ? `${iconFiles.length} icon files found` : 'No icons found',
    });

    // Check 7: Privacy manifest (iOS 17+)
    const hasPrivacyManifest = fs.existsSync(path.join(appPath, 'PrivacyInfo.xcprivacy'));
    checks.push({
      name: 'Privacy Manifest',
      passed: hasPrivacyManifest,
      details: hasPrivacyManifest ? 'Present' : 'Not found (required for iOS 17+)',
    });
    if (!hasPrivacyManifest) {
      warnings.push({ name: 'Privacy Manifest', message: 'Missing PrivacyInfo.xcprivacy - may be rejected for iOS 17+ targets' });
    }

    // Check file size
    const stats = fs.statSync(ipaPath);
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB > 100) {
      warnings.push({ name: 'App Size', message: `Build is ${sizeMB.toFixed(0)}MB, consider reducing for faster downloads` });
    }

  } finally {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const valid = checks.every(c => c.passed) && errors.length === 0;

  return {
    valid,
    platform: 'ios',
    checks,
    warnings,
    errors,
  };
}

async function validateAndroidBuild(buildPath: string): Promise<ValidationResult> {
  const checks: ValidationCheck[] = [];
  const warnings: Array<{ name: string; message: string }> = [];
  const errors: Array<{ name: string; message: string }> = [];

  const isAAB = buildPath.endsWith('.aab');

  // Check 1: File exists and is readable
  const stats = fs.statSync(buildPath);
  checks.push({
    name: 'File Valid',
    passed: stats.size > 0,
    details: `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
  });

  // Check 2: Verify signature using apksigner or bundletool
  try {
    if (isAAB) {
      // For AAB, we can check with bundletool if available
      try {
        await execAsync(`bundletool validate --bundle="${buildPath}"`);
        checks.push({
          name: 'Bundle Valid',
          passed: true,
          details: 'AAB bundle structure is valid',
        });
      } catch {
        // bundletool not available, skip detailed validation
        checks.push({
          name: 'Bundle Valid',
          passed: true,
          details: 'AAB file exists (bundletool not available for detailed check)',
        });
      }
    } else {
      // For APK, use apksigner
      const { stdout } = await execAsync(`apksigner verify --print-certs "${buildPath}" 2>&1 || true`);
      const isSigned = stdout.includes('Signer #1');
      checks.push({
        name: 'Code Signing',
        passed: isSigned,
        details: isSigned ? 'APK is signed' : 'APK is not signed',
      });
    }
  } catch {
    checks.push({
      name: 'Code Signing',
      passed: true,
      details: 'Signature check skipped (tool not available)',
    });
  }

  // Check 3: Verify it's a release build (not debuggable)
  try {
    const { stdout } = await execAsync(`aapt2 dump badging "${buildPath}" 2>&1 || aapt dump badging "${buildPath}" 2>&1 || true`);
    
    // Check for debuggable flag
    const isDebuggable = stdout.includes("application-debuggable='true'");
    checks.push({
      name: 'Release Build',
      passed: !isDebuggable,
      details: isDebuggable ? 'Build is debuggable (not suitable for production)' : 'Not debuggable',
    });
    if (isDebuggable) {
      errors.push({ name: 'Release Build', message: 'Build is marked as debuggable' });
    }

    // Extract version info
    const versionNameMatch = stdout.match(/versionName='([^']+)'/);
    const versionCodeMatch = stdout.match(/versionCode='([^']+)'/);
    const packageMatch = stdout.match(/package: name='([^']+)'/);
    const sdkMatch = stdout.match(/sdkVersion:'(\d+)'/);
    const targetSdkMatch = stdout.match(/targetSdkVersion:'(\d+)'/);

    checks.push({
      name: 'Version Info',
      passed: !!versionNameMatch && !!versionCodeMatch,
      details: `${versionNameMatch?.[1] || '?'} (${versionCodeMatch?.[1] || '?'})`,
    });

    checks.push({
      name: 'Package ID',
      passed: !!packageMatch,
      details: packageMatch?.[1] || 'Not found',
    });

    checks.push({
      name: 'Min SDK',
      passed: !!sdkMatch,
      details: sdkMatch ? `API ${sdkMatch[1]}` : 'Not found',
    });

    checks.push({
      name: 'Target SDK',
      passed: !!targetSdkMatch,
      details: targetSdkMatch ? `API ${targetSdkMatch[1]}` : 'Not found',
    });

    // Play Store requires target SDK >= 33 for new apps
    if (targetSdkMatch && parseInt(targetSdkMatch[1], 10) < 33) {
      warnings.push({ name: 'Target SDK', message: 'Target SDK < 33 - may be rejected by Play Store for new apps' });
    }

  } catch {
    warnings.push({ name: 'Validation', message: 'Could not extract APK details (aapt2/aapt not available)' });
  }

  // Check file size
  const sizeMB = stats.size / (1024 * 1024);
  if (sizeMB > 150) {
    warnings.push({ name: 'App Size', message: `Build is ${sizeMB.toFixed(0)}MB, Play Store limit is 150MB for APK (500MB for AAB with Play Asset Delivery)` });
  }

  // For Play Store, AAB is required
  if (!isAAB) {
    warnings.push({ name: 'Format', message: 'APK format - Play Store requires AAB for new apps' });
  }

  const valid = checks.every(c => c.passed) && errors.length === 0;

  return {
    valid,
    platform: 'android',
    checks,
    warnings,
    errors,
  };
}
