/**
 * Build Tools - Build and run mobile apps
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// MARK: - Tool Definitions

export const buildTools = [
  {
    name: 'build_app',
    description: 'Build a mobile app (React Native, iOS, or Android)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'react-native-ios', 'react-native-android'],
          description: 'Target platform',
        },
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        configuration: {
          type: 'string',
          enum: ['debug', 'release'],
          description: 'Build configuration (default: debug)',
        },
      },
      required: ['platform', 'projectPath'],
    },
  },
  {
    name: 'run_app',
    description: 'Build and run an app on simulator/emulator',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'react-native-ios', 'react-native-android'],
          description: 'Target platform',
        },
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        deviceId: {
          type: 'string',
          description: 'Target device/simulator ID (optional)',
        },
        configuration: {
          type: 'string',
          enum: ['debug', 'release'],
          description: 'Build configuration (default: debug)',
        },
      },
      required: ['platform', 'projectPath'],
    },
  },
  {
    name: 'run_demo_app',
    description: 'Build and run one of the MCP demo apps',
    inputSchema: {
      type: 'object' as const,
      properties: {
        demo: {
          type: 'string',
          enum: ['react-native', 'ios', 'android'],
          description: 'Which demo app to run',
        },
        simulator: {
          type: 'string',
          description: 'Simulator name (e.g., "iPhone 15 Pro")',
        },
      },
      required: ['demo'],
    },
  },
  {
    name: 'get_build_status',
    description: 'Check the status of a running build',
    inputSchema: {
      type: 'object' as const,
      properties: {
        buildId: {
          type: 'string',
          description: 'Build ID to check',
        },
      },
    },
  },
  {
    name: 'clean_build',
    description: 'Clean build artifacts for a project',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'react-native'],
        },
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
      },
      required: ['platform', 'projectPath'],
    },
  },
];

// Track running builds
interface BuildProcess {
  id: string;
  platform: string;
  status: 'building' | 'success' | 'failed' | 'cancelled';
  output: string[];
  startTime: Date;
  endTime?: Date;
  process?: ReturnType<typeof spawn>;
}

const runningBuilds: Map<string, BuildProcess> = new Map();

// MARK: - Handler

export async function handleBuildTool(
  name: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'build_app':
      return buildApp(params);
    case 'run_app':
      return runApp(params);
    case 'run_demo_app':
      return runDemoApp(params);
    case 'get_build_status':
      return getBuildStatus(params);
    case 'clean_build':
      return cleanBuild(params);
    default:
      throw new Error(`Unknown build tool: ${name}`);
  }
}

// MARK: - Build Functions

async function buildApp(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const projectPath = params.projectPath as string;
  const configuration = (params.configuration as string) || 'debug';

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  const buildId = `build_${Date.now()}`;

  const build: BuildProcess = {
    id: buildId,
    platform,
    status: 'building',
    output: [],
    startTime: new Date(),
  };

  runningBuilds.set(buildId, build);

  try {
    switch (platform) {
      case 'ios':
        await buildIOS(projectPath, configuration, build);
        break;
      case 'android':
        await buildAndroid(projectPath, configuration, build);
        break;
      case 'react-native-ios':
        await buildReactNativeIOS(projectPath, configuration, build);
        break;
      case 'react-native-android':
        await buildReactNativeAndroid(projectPath, configuration, build);
        break;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }

    build.status = 'success';
    build.endTime = new Date();

    return {
      buildId,
      status: 'success',
      duration: build.endTime.getTime() - build.startTime.getTime(),
      output: build.output.slice(-20), // Last 20 lines
    };
  } catch (error) {
    build.status = 'failed';
    build.endTime = new Date();

    return {
      buildId,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      output: build.output.slice(-30),
    };
  }
}

async function buildIOS(projectPath: string, configuration: string, build: BuildProcess): Promise<void> {
  const xcodeproj = fs.readdirSync(projectPath).find(f => f.endsWith('.xcodeproj'));
  const xcworkspace = fs.readdirSync(projectPath).find(f => f.endsWith('.xcworkspace'));

  if (!xcodeproj && !xcworkspace) {
    throw new Error('No Xcode project or workspace found');
  }

  const project = xcworkspace
    ? `-workspace "${path.join(projectPath, xcworkspace)}"`
    : `-project "${path.join(projectPath, xcodeproj!)}"`;

  const schemeName = xcodeproj ? path.basename(xcodeproj, '.xcodeproj') : 'App';
  const cmd = `xcodebuild ${project} -scheme "${schemeName}" -configuration ${configuration === 'debug' ? 'Debug' : 'Release'} -destination 'generic/platform=iOS Simulator' build`;

  const { stdout, stderr } = await execAsync(cmd, {
    cwd: projectPath,
    maxBuffer: 10 * 1024 * 1024,
  });

  build.output.push(...stdout.split('\n'));
  if (stderr) build.output.push(...stderr.split('\n'));
}

async function buildAndroid(projectPath: string, configuration: string, build: BuildProcess): Promise<void> {
  const gradlew = path.join(projectPath, 'gradlew');
  const task = configuration === 'debug' ? 'assembleDebug' : 'assembleRelease';

  if (!fs.existsSync(gradlew)) {
    throw new Error('gradlew not found. Is this an Android project?');
  }

  const { stdout, stderr } = await execAsync(`./gradlew ${task}`, {
    cwd: projectPath,
    maxBuffer: 10 * 1024 * 1024,
  });

  build.output.push(...stdout.split('\n'));
  if (stderr) build.output.push(...stderr.split('\n'));
}

async function buildReactNativeIOS(projectPath: string, configuration: string, build: BuildProcess): Promise<void> {
  // Install dependencies if needed
  if (!fs.existsSync(path.join(projectPath, 'node_modules'))) {
    build.output.push('Installing npm dependencies...');
    await execAsync('npm install', { cwd: projectPath });
  }

  // Install pods if needed
  const iosPath = path.join(projectPath, 'ios');
  if (fs.existsSync(iosPath) && !fs.existsSync(path.join(iosPath, 'Pods'))) {
    build.output.push('Installing CocoaPods...');
    await execAsync('pod install', { cwd: iosPath });
  }

  build.output.push('Building React Native iOS...');
  const { stdout } = await execAsync(
    `npx react-native build-ios --mode=${configuration}`,
    { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }
  );

  build.output.push(...stdout.split('\n'));
}

async function buildReactNativeAndroid(projectPath: string, configuration: string, build: BuildProcess): Promise<void> {
  // Install dependencies if needed
  if (!fs.existsSync(path.join(projectPath, 'node_modules'))) {
    build.output.push('Installing npm dependencies...');
    await execAsync('npm install', { cwd: projectPath });
  }

  build.output.push('Building React Native Android...');
  const { stdout } = await execAsync(
    `npx react-native build-android --mode=${configuration}`,
    { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }
  );

  build.output.push(...stdout.split('\n'));
}

// MARK: - Run Functions

async function runApp(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const projectPath = params.projectPath as string;
  const deviceId = params.deviceId as string | undefined;
  const configuration = (params.configuration as string) || 'debug';

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  switch (platform) {
    case 'react-native-ios':
      return runReactNativeIOS(projectPath, deviceId);
    case 'react-native-android':
      return runReactNativeAndroid(projectPath, deviceId);
    case 'ios':
      return runNativeIOS(projectPath, deviceId, configuration);
    case 'android':
      return runNativeAndroid(projectPath, deviceId, configuration);
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

async function runReactNativeIOS(projectPath: string, simulator?: string): Promise<unknown> {
  const simArg = simulator ? `--simulator="${simulator}"` : '';
  
  // Run in background
  const child = spawn('npx', ['react-native', 'run-ios', simArg].filter(Boolean), {
    cwd: projectPath,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  return {
    success: true,
    message: `React Native iOS app starting on ${simulator || 'default simulator'}`,
    note: 'Metro bundler will start automatically if not running',
  };
}

async function runReactNativeAndroid(projectPath: string, deviceId?: string): Promise<unknown> {
  const child = spawn('npx', ['react-native', 'run-android'], {
    cwd: projectPath,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  return {
    success: true,
    message: 'React Native Android app starting',
    note: 'Metro bundler will start automatically if not running',
  };
}

async function runNativeIOS(projectPath: string, deviceId?: string, configuration?: string): Promise<unknown> {
  // Find booted simulator
  if (!deviceId) {
    const { stdout } = await execAsync('xcrun simctl list devices booted -j');
    const data = JSON.parse(stdout);
    for (const [, devices] of Object.entries(data.devices)) {
      const bootedDevices = devices as Array<{ udid: string; name: string; state: string }>;
      const booted = bootedDevices.find(d => d.state === 'Booted');
      if (booted) {
        deviceId = booted.udid;
        break;
      }
    }
  }

  if (!deviceId) {
    throw new Error('No booted simulator found. Boot one first with boot_simulator.');
  }

  // Find and run the app
  const xcodeproj = fs.readdirSync(projectPath).find(f => f.endsWith('.xcodeproj'));
  if (!xcodeproj) {
    throw new Error('No Xcode project found');
  }

  const scheme = path.basename(xcodeproj, '.xcodeproj');
  
  // Build and run
  await execAsync(
    `xcodebuild -project "${path.join(projectPath, xcodeproj)}" -scheme "${scheme}" -destination "id=${deviceId}" -configuration ${configuration === 'release' ? 'Release' : 'Debug'} build`,
    { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }
  );

  // Find the built app
  const buildDir = path.join(projectPath, 'build');
  const { stdout: appPath } = await execAsync(`find "${buildDir}" -name "*.app" -type d | head -1`);
  
  if (appPath.trim()) {
    await execAsync(`xcrun simctl install "${deviceId}" "${appPath.trim()}"`);
    // Get bundle ID from Info.plist
    const { stdout: bundleId } = await execAsync(`defaults read "${appPath.trim()}/Info" CFBundleIdentifier`);
    await execAsync(`xcrun simctl launch "${deviceId}" "${bundleId.trim()}"`);
  }

  return {
    success: true,
    message: `iOS app launched on simulator ${deviceId}`,
  };
}

async function runNativeAndroid(projectPath: string, deviceId?: string, configuration?: string): Promise<unknown> {
  // Build
  const task = configuration === 'release' ? 'installRelease' : 'installDebug';
  await execAsync(`./gradlew ${task}`, { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 });

  // Find package name from AndroidManifest
  const manifestPath = path.join(projectPath, 'app/src/main/AndroidManifest.xml');
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  const packageMatch = manifest.match(/package="([^"]+)"/);
  const packageName = packageMatch ? packageMatch[1] : 'com.example.app';

  // Launch
  const deviceArg = deviceId ? `-s ${deviceId}` : '';
  await execAsync(`adb ${deviceArg} shell monkey -p ${packageName} 1`);

  return {
    success: true,
    message: `Android app launched`,
    package: packageName,
  };
}

// MARK: - Demo App Runner

async function runDemoApp(params: Record<string, unknown>): Promise<unknown> {
  const demo = params.demo as string;
  const simulator = params.simulator as string | undefined;

  // Get the project root (relative to mcp-server package)
  const serverDir = path.dirname(path.dirname(__dirname));
  const projectRoot = path.dirname(path.dirname(serverDir));
  const scriptsDir = path.join(projectRoot, 'scripts');

  let script: string;
  let args: string[] = [];

  switch (demo) {
    case 'react-native':
      script = path.join(scriptsDir, 'run-rn-demo.sh');
      args = ['ios'];
      if (simulator) args.push(simulator);
      break;
    case 'ios':
      script = path.join(scriptsDir, 'run-ios-demo.sh');
      if (simulator) args.push(simulator);
      break;
    case 'android':
      script = path.join(scriptsDir, 'run-android-demo.sh');
      break;
    default:
      throw new Error(`Unknown demo: ${demo}`);
  }

  if (!fs.existsSync(script)) {
    return {
      success: false,
      error: `Script not found: ${script}`,
      help: `Demo scripts are in the 'scripts/' directory. Available: run-rn-demo.sh, run-ios-demo.sh, run-android-demo.sh`,
    };
  }

  // Run the script
  const child = spawn('bash', [script, ...args], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  return {
    success: true,
    message: `Starting ${demo} demo app...`,
    script,
    simulator: simulator || 'default',
    note: 'The app will build and launch on the simulator. This may take a minute.',
  };
}

// MARK: - Status & Clean

function getBuildStatus(params: Record<string, unknown>): unknown {
  const buildId = params.buildId as string;

  if (buildId) {
    const build = runningBuilds.get(buildId);
    if (!build) {
      return { error: `Build not found: ${buildId}` };
    }

    return {
      buildId: build.id,
      platform: build.platform,
      status: build.status,
      startTime: build.startTime.toISOString(),
      endTime: build.endTime?.toISOString(),
      duration: build.endTime
        ? build.endTime.getTime() - build.startTime.getTime()
        : Date.now() - build.startTime.getTime(),
      output: build.output.slice(-20),
    };
  }

  // Return all recent builds
  const builds = Array.from(runningBuilds.values())
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    .slice(0, 10)
    .map(b => ({
      buildId: b.id,
      platform: b.platform,
      status: b.status,
      startTime: b.startTime.toISOString(),
    }));

  return { builds };
}

async function cleanBuild(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const projectPath = params.projectPath as string;

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  const cleaned: string[] = [];

  switch (platform) {
    case 'ios':
      const iosBuildDir = path.join(projectPath, 'build');
      const derivedData = path.join(projectPath, 'DerivedData');
      if (fs.existsSync(iosBuildDir)) {
        fs.rmSync(iosBuildDir, { recursive: true });
        cleaned.push('build/');
      }
      if (fs.existsSync(derivedData)) {
        fs.rmSync(derivedData, { recursive: true });
        cleaned.push('DerivedData/');
      }
      break;

    case 'android':
      const androidBuildDir = path.join(projectPath, 'app/build');
      const gradleBuildDir = path.join(projectPath, 'build');
      if (fs.existsSync(androidBuildDir)) {
        fs.rmSync(androidBuildDir, { recursive: true });
        cleaned.push('app/build/');
      }
      if (fs.existsSync(gradleBuildDir)) {
        fs.rmSync(gradleBuildDir, { recursive: true });
        cleaned.push('build/');
      }
      break;

    case 'react-native':
      const nodeModules = path.join(projectPath, 'node_modules');
      const metroCache = path.join(projectPath, 'node_modules/.cache');
      const iosPods = path.join(projectPath, 'ios/Pods');
      const iosBuild = path.join(projectPath, 'ios/build');
      const androidBuild = path.join(projectPath, 'android/app/build');

      if (fs.existsSync(metroCache)) {
        fs.rmSync(metroCache, { recursive: true });
        cleaned.push('node_modules/.cache/');
      }
      if (fs.existsSync(iosPods)) {
        fs.rmSync(iosPods, { recursive: true });
        cleaned.push('ios/Pods/');
      }
      if (fs.existsSync(iosBuild)) {
        fs.rmSync(iosBuild, { recursive: true });
        cleaned.push('ios/build/');
      }
      if (fs.existsSync(androidBuild)) {
        fs.rmSync(androidBuild, { recursive: true });
        cleaned.push('android/app/build/');
      }
      break;
  }

  return {
    success: true,
    cleaned,
    message: cleaned.length > 0 ? `Cleaned ${cleaned.length} directories` : 'Nothing to clean',
  };
}
