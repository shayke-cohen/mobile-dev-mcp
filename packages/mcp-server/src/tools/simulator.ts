/**
 * Simulator Tools - Control iOS Simulator and Android Emulator
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// MARK: - Tool Definitions

export const simulatorTools = [
  // iOS Simulator Tools
  {
    name: 'list_simulators',
    description: 'List available iOS Simulators and Android Emulators',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'all'],
          description: 'Filter by platform',
        },
        state: {
          type: 'string',
          enum: ['booted', 'shutdown', 'all'],
          description: 'Filter by state',
        },
      },
    },
  },
  {
    name: 'boot_simulator',
    description: 'Boot an iOS Simulator or Android Emulator',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
          description: 'Platform to boot',
        },
        deviceId: {
          type: 'string',
          description: 'Device ID/name to boot',
        },
      },
      required: ['platform', 'deviceId'],
    },
  },
  {
    name: 'shutdown_simulator',
    description: 'Shutdown an iOS Simulator or Android Emulator',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
        },
        deviceId: {
          type: 'string',
          description: 'Device ID to shutdown. Use "all" to shutdown all.',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'install_app',
    description: 'Install an app on simulator/emulator',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
        },
        deviceId: {
          type: 'string',
          description: 'Target device ID (optional, uses booted device)',
        },
        appPath: {
          type: 'string',
          description: 'Path to .app (iOS) or .apk (Android)',
        },
      },
      required: ['platform', 'appPath'],
    },
  },
  {
    name: 'launch_app',
    description: 'Launch an app on simulator/emulator or macOS',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'macos'],
        },
        deviceId: {
          type: 'string',
          description: 'Target device ID (iOS/Android) or app name (macOS)',
        },
        bundleId: {
          type: 'string',
          description: 'App bundle ID (iOS/macOS) or package name (Android)',
        },
        appName: {
          type: 'string',
          description: 'macOS only: App name to launch (e.g., "Safari", "MCPDemoApp")',
        },
        arguments: {
          type: 'array',
          items: { type: 'string' },
          description: 'Launch arguments',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'terminate_app',
    description: 'Terminate a running app',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'macos'],
        },
        deviceId: {
          type: 'string',
        },
        bundleId: {
          type: 'string',
          description: 'App bundle ID or package name',
        },
        appName: {
          type: 'string',
          description: 'macOS only: App name to terminate',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'uninstall_app',
    description: 'Uninstall an app from simulator/emulator',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
        },
        deviceId: {
          type: 'string',
        },
        bundleId: {
          type: 'string',
        },
      },
      required: ['platform', 'bundleId'],
    },
  },
  {
    name: 'simulator_screenshot',
    description: 'Take a screenshot of the simulator/emulator or macOS app window',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'macos'],
        },
        deviceId: {
          type: 'string',
          description: 'Device ID for iOS/Android, or app name/bundle ID for macOS',
        },
        outputPath: {
          type: 'string',
          description: 'Where to save the screenshot (optional)',
        },
        windowTitle: {
          type: 'string',
          description: 'macOS only: Window title to capture (captures first matching window)',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'simulator_record',
    description: 'Start/stop video recording of simulator or macOS screen',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'macos'],
        },
        action: {
          type: 'string',
          enum: ['start', 'stop'],
        },
        deviceId: {
          type: 'string',
        },
        outputPath: {
          type: 'string',
        },
      },
      required: ['platform', 'action'],
    },
  },
  {
    name: 'open_url',
    description: 'Open a URL in the simulator/emulator or macOS',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'macos'],
        },
        deviceId: {
          type: 'string',
        },
        url: {
          type: 'string',
          description: 'URL to open (can be deep link)',
        },
        appName: {
          type: 'string',
          description: 'macOS only: App to open URL with (optional, uses default browser if not specified)',
        },
      },
      required: ['platform', 'url'],
    },
  },
  {
    name: 'push_notification',
    description: 'Send a push notification to the simulator (iOS only)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        deviceId: {
          type: 'string',
        },
        bundleId: {
          type: 'string',
          description: 'Target app bundle ID',
        },
        payload: {
          type: 'object',
          description: 'APNS payload',
        },
      },
      required: ['bundleId', 'payload'],
    },
  },
  {
    name: 'set_location',
    description: 'Set the simulated GPS location',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
        },
        deviceId: {
          type: 'string',
        },
        latitude: {
          type: 'number',
        },
        longitude: {
          type: 'number',
        },
      },
      required: ['platform', 'latitude', 'longitude'],
    },
  },
  {
    name: 'get_app_container',
    description: 'Get the app container path (iOS) or data directory (Android)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
        },
        deviceId: {
          type: 'string',
        },
        bundleId: {
          type: 'string',
        },
        container: {
          type: 'string',
          enum: ['app', 'data', 'groups'],
          description: 'Container type (iOS only)',
        },
      },
      required: ['platform', 'bundleId'],
    },
  },
  {
    name: 'clear_app_data',
    description: 'Clear app data/cache',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
        },
        deviceId: {
          type: 'string',
        },
        bundleId: {
          type: 'string',
        },
      },
      required: ['platform', 'bundleId'],
    },
  },
  {
    name: 'get_device_logs',
    description: 'Get system logs from simulator/emulator',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
        },
        deviceId: {
          type: 'string',
        },
        filter: {
          type: 'string',
          description: 'Filter logs by keyword or process',
        },
        lines: {
          type: 'number',
          description: 'Number of lines to return',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'list_running_apps',
    description: 'List running applications on macOS',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filter: {
          type: 'string',
          description: 'Filter apps by name (optional)',
        },
      },
    },
  },
  {
    name: 'build_macos_app',
    description: 'Build a macOS app using Swift Package Manager or xcodebuild',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the macOS project directory',
        },
        scheme: {
          type: 'string',
          description: 'Xcode scheme name (for .xcodeproj/.xcworkspace)',
        },
        configuration: {
          type: 'string',
          enum: ['debug', 'release'],
          description: 'Build configuration (default: debug)',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'run_macos_app',
    description: 'Build and run a macOS app',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the macOS project directory',
        },
        scheme: {
          type: 'string',
          description: 'Xcode scheme name (optional)',
        },
        arguments: {
          type: 'array',
          items: { type: 'string' },
          description: 'Arguments to pass to the app',
        },
      },
      required: ['projectPath'],
    },
  },
];

// MARK: - Handler

export async function handleSimulatorTool(
  name: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'list_simulators':
      return listSimulators(params);
    case 'boot_simulator':
      return bootSimulator(params);
    case 'shutdown_simulator':
      return shutdownSimulator(params);
    case 'install_app':
      return installApp(params);
    case 'launch_app':
      return launchApp(params);
    case 'terminate_app':
      return terminateApp(params);
    case 'uninstall_app':
      return uninstallApp(params);
    case 'simulator_screenshot':
      return takeScreenshot(params);
    case 'simulator_record':
      return recordVideo(params);
    case 'open_url':
      return openUrl(params);
    case 'push_notification':
      return pushNotification(params);
    case 'set_location':
      return setLocation(params);
    case 'get_app_container':
      return getAppContainer(params);
    case 'clear_app_data':
      return clearAppData(params);
    case 'get_device_logs':
      return getDeviceLogs(params);
    case 'list_running_apps':
      return listRunningApps(params);
    case 'build_macos_app':
      return buildMacOSApp(params);
    case 'run_macos_app':
      return runMacOSApp(params);
    default:
      throw new Error(`Unknown simulator tool: ${name}`);
  }
}

// MARK: - iOS Simulator Functions

async function listIOSSimulators(state?: string): Promise<unknown[]> {
  try {
    const { stdout } = await execAsync('xcrun simctl list devices -j');
    const data = JSON.parse(stdout);
    const devices: unknown[] = [];

    for (const [runtime, deviceList] of Object.entries(data.devices)) {
      if (!Array.isArray(deviceList)) continue;
      
      for (const device of deviceList) {
        const d = device as { name: string; udid: string; state: string };
        if (state && state !== 'all' && d.state.toLowerCase() !== state) continue;
        
        devices.push({
          platform: 'ios',
          id: d.udid,
          name: d.name,
          state: d.state.toLowerCase(),
          runtime: runtime.replace('com.apple.CoreSimulator.SimRuntime.', ''),
        });
      }
    }

    return devices;
  } catch {
    return [];
  }
}

async function bootIOSSimulator(deviceId: string): Promise<{ success: boolean; message: string }> {
  try {
    await execAsync(`xcrun simctl boot "${deviceId}"`);
    // Open Simulator app
    await execAsync('open -a Simulator');
    return { success: true, message: `Booted iOS Simulator: ${deviceId}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Unable to boot device in current state: Booted')) {
      return { success: true, message: 'Simulator already booted' };
    }
    throw error;
  }
}

async function shutdownIOSSimulator(deviceId?: string): Promise<{ success: boolean; message: string }> {
  if (deviceId === 'all' || !deviceId) {
    await execAsync('xcrun simctl shutdown all');
    return { success: true, message: 'Shutdown all iOS Simulators' };
  }
  await execAsync(`xcrun simctl shutdown "${deviceId}"`);
  return { success: true, message: `Shutdown iOS Simulator: ${deviceId}` };
}

async function getBootedIOSSimulator(): Promise<string | null> {
  const devices = await listIOSSimulators('booted') as Array<{ id: string }>;
  return devices.length > 0 ? devices[0].id : null;
}

// MARK: - Android Emulator Functions

async function listAndroidEmulators(state?: string): Promise<unknown[]> {
  const devices: unknown[] = [];
  
  try {
    // List available AVDs
    const { stdout: avdList } = await execAsync('emulator -list-avds 2>/dev/null || true');
    const avds = avdList.trim().split('\n').filter(Boolean);
    
    // List running emulators
    const { stdout: adbDevices } = await execAsync('adb devices 2>/dev/null || true');
    const runningEmulators = adbDevices
      .split('\n')
      .filter(line => line.includes('emulator'))
      .map(line => line.split('\t')[0]);

    for (const avd of avds) {
      const isBooted = runningEmulators.some(e => e.includes('emulator'));
      
      if (state === 'booted' && !isBooted) continue;
      if (state === 'shutdown' && isBooted) continue;
      
      devices.push({
        platform: 'android',
        id: avd,
        name: avd,
        state: isBooted ? 'booted' : 'shutdown',
      });
    }

    // Add running emulators from adb
    for (const emulatorId of runningEmulators) {
      if (!devices.some((d: any) => d.id === emulatorId)) {
        devices.push({
          platform: 'android',
          id: emulatorId,
          name: emulatorId,
          state: 'booted',
        });
      }
    }
  } catch {
    // Android tools not available
  }

  return devices;
}

async function bootAndroidEmulator(deviceId: string): Promise<{ success: boolean; message: string }> {
  // Start emulator in background
  const child = spawn('emulator', ['-avd', deviceId], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  
  // Wait for device to be ready
  let attempts = 0;
  while (attempts < 30) {
    try {
      const { stdout } = await execAsync('adb devices');
      if (stdout.includes('emulator') && stdout.includes('device')) {
        return { success: true, message: `Booted Android Emulator: ${deviceId}` };
      }
    } catch {
      // Continue waiting
    }
    await new Promise(r => setTimeout(r, 2000));
    attempts++;
  }
  
  return { success: true, message: `Android Emulator starting: ${deviceId} (may take a moment)` };
}

async function shutdownAndroidEmulator(deviceId?: string): Promise<{ success: boolean; message: string }> {
  if (deviceId && deviceId !== 'all') {
    await execAsync(`adb -s ${deviceId} emu kill`);
    return { success: true, message: `Shutdown Android Emulator: ${deviceId}` };
  }
  
  // Kill all emulators
  const { stdout } = await execAsync('adb devices');
  const emulators = stdout.split('\n').filter(l => l.includes('emulator')).map(l => l.split('\t')[0]);
  
  for (const emu of emulators) {
    await execAsync(`adb -s ${emu} emu kill`).catch(() => {});
  }
  
  return { success: true, message: 'Shutdown all Android Emulators' };
}

async function getBootedAndroidEmulator(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('adb devices');
    const match = stdout.match(/(emulator-\d+)\s+device/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// MARK: - Combined Functions

async function listSimulators(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string || 'all';
  const state = params.state as string || 'all';
  
  const devices: unknown[] = [];
  
  if (platform === 'ios' || platform === 'all') {
    devices.push(...await listIOSSimulators(state));
  }
  
  if (platform === 'android' || platform === 'all') {
    devices.push(...await listAndroidEmulators(state));
  }
  
  return {
    devices,
    count: devices.length,
  };
}

async function bootSimulator(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const deviceId = params.deviceId as string;
  
  if (platform === 'ios') {
    return bootIOSSimulator(deviceId);
  } else {
    return bootAndroidEmulator(deviceId);
  }
}

async function shutdownSimulator(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const deviceId = params.deviceId as string | undefined;
  
  if (platform === 'ios') {
    return shutdownIOSSimulator(deviceId);
  } else {
    return shutdownAndroidEmulator(deviceId);
  }
}

async function installApp(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const appPath = params.appPath as string;
  let deviceId = params.deviceId as string | undefined;
  
  if (!fs.existsSync(appPath)) {
    throw new Error(`App not found: ${appPath}`);
  }
  
  if (platform === 'ios') {
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    await execAsync(`xcrun simctl install "${deviceId}" "${appPath}"`);
    return { success: true, message: `Installed on iOS Simulator: ${deviceId}`, appPath };
  } else {
    deviceId = deviceId || await getBootedAndroidEmulator() || undefined;
    if (!deviceId) throw new Error('No running Android Emulator found');
    
    await execAsync(`adb -s ${deviceId} install -r "${appPath}"`);
    return { success: true, message: `Installed on Android Emulator: ${deviceId}`, appPath };
  }
}

async function launchApp(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const bundleId = params.bundleId as string | undefined;
  const appName = params.appName as string | undefined;
  let deviceId = params.deviceId as string | undefined;
  const args = params.arguments as string[] | undefined;
  
  if (platform === 'ios') {
    if (!bundleId) throw new Error('bundleId is required for iOS');
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    let cmd = `xcrun simctl launch "${deviceId}" "${bundleId}"`;
    if (args?.length) {
      cmd += ' ' + args.map(a => `"${a}"`).join(' ');
    }
    
    await execAsync(cmd);
    return { success: true, message: `Launched ${bundleId} on iOS Simulator` };
  } else if (platform === 'macos') {
    const app = appName || bundleId || deviceId;
    if (!app) throw new Error('appName, bundleId, or deviceId is required for macOS');
    
    let cmd: string;
    if (app.endsWith('.app') || app.startsWith('/')) {
      // Full path to app
      cmd = `open "${app}"`;
    } else if (app.includes('.')) {
      // Bundle ID - use open -b
      cmd = `open -b "${app}"`;
    } else {
      // App name - use open -a
      cmd = `open -a "${app}"`;
    }
    
    if (args?.length) {
      cmd += ' --args ' + args.map(a => `"${a}"`).join(' ');
    }
    
    await execAsync(cmd);
    return { success: true, message: `Launched ${app} on macOS`, platform: 'macos' };
  } else {
    // Android
    if (!bundleId) throw new Error('bundleId is required for Android');
    deviceId = deviceId || await getBootedAndroidEmulator() || undefined;
    if (!deviceId) throw new Error('No running Android Emulator found');
    
    await execAsync(`adb -s ${deviceId} shell monkey -p ${bundleId} 1`);
    return { success: true, message: `Launched ${bundleId} on Android Emulator` };
  }
}

async function terminateApp(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const bundleId = params.bundleId as string | undefined;
  const appName = params.appName as string | undefined;
  let deviceId = params.deviceId as string | undefined;
  
  if (platform === 'ios') {
    if (!bundleId) throw new Error('bundleId is required for iOS');
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    await execAsync(`xcrun simctl terminate "${deviceId}" "${bundleId}"`);
    return { success: true, message: `Terminated ${bundleId}` };
  } else if (platform === 'macos') {
    const app = appName || bundleId;
    if (!app) throw new Error('appName or bundleId is required for macOS');
    
    try {
      // Try to quit gracefully first using AppleScript
      await execAsync(`osascript -e 'tell application "${app}" to quit'`);
      return { success: true, message: `Terminated ${app}`, platform: 'macos' };
    } catch {
      // If that fails, force kill using pkill
      try {
        await execAsync(`pkill -f "${app}"`);
        return { success: true, message: `Force terminated ${app}`, platform: 'macos' };
      } catch {
        return { success: false, message: `Could not terminate ${app} - may not be running`, platform: 'macos' };
      }
    }
  } else {
    // Android
    if (!bundleId) throw new Error('bundleId is required for Android');
    deviceId = deviceId || await getBootedAndroidEmulator() || undefined;
    if (!deviceId) throw new Error('No running Android Emulator found');
    
    await execAsync(`adb -s ${deviceId} shell am force-stop ${bundleId}`);
    return { success: true, message: `Terminated ${bundleId}` };
  }
}

async function uninstallApp(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const bundleId = params.bundleId as string;
  let deviceId = params.deviceId as string | undefined;
  
  if (platform === 'ios') {
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    await execAsync(`xcrun simctl uninstall "${deviceId}" "${bundleId}"`);
    return { success: true, message: `Uninstalled ${bundleId}` };
  } else {
    deviceId = deviceId || await getBootedAndroidEmulator() || undefined;
    if (!deviceId) throw new Error('No running Android Emulator found');
    
    await execAsync(`adb -s ${deviceId} uninstall ${bundleId}`);
    return { success: true, message: `Uninstalled ${bundleId}` };
  }
}

async function takeScreenshot(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  let deviceId = params.deviceId as string | undefined;
  const outputPath = params.outputPath as string || path.join(os.tmpdir(), `screenshot_${Date.now()}.png`);
  
  if (platform === 'ios') {
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    await execAsync(`xcrun simctl io "${deviceId}" screenshot "${outputPath}"`);
    
    // Read and return base64
    const data = fs.readFileSync(outputPath);
    return {
      success: true,
      path: outputPath,
      image: data.toString('base64'),
      format: 'png',
    };
  } else if (platform === 'macos') {
    // macOS app screenshot using screencapture
    const windowTitle = params.windowTitle as string | undefined;
    const appName = deviceId; // deviceId is used as app name for macOS
    
    if (appName) {
      // Activate the app first
      await execAsync(`osascript -e 'tell application "${appName}" to activate'`).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for app to come to front
    }
    
    if (windowTitle || appName) {
      // Get window ID and capture it using screencapture -l
      const searchTerm = windowTitle || appName || '';
      
      // Get window list and find matching window ID
      const getWindowIdScript = `
        set windowId to 0
        tell application "System Events"
          repeat with proc in (every process whose background only is false)
            try
              if name of proc contains "${searchTerm}" then
                tell proc
                  if (count of windows) > 0 then
                    set frontWin to front window
                    -- Get window ID using accessibility
                    set windowId to id of frontWin
                  end if
                end tell
                exit repeat
              end if
            end try
          end repeat
        end tell
        return windowId
      `;
      
      try {
        // Try to get window ID via AppleScript
        const { stdout: windowIdStr } = await execAsync(`osascript -e '${getWindowIdScript}'`);
        const windowId = parseInt(windowIdStr.trim(), 10);
        
        if (windowId && windowId > 0) {
          // Capture specific window by ID
          await execAsync(`screencapture -l ${windowId} -x "${outputPath}"`);
        } else {
          // Fallback: capture frontmost window
          // Use a small delay then capture what's in front
          await execAsync(`screencapture -x -o "${outputPath}"`);
        }
      } catch {
        // Fallback: capture entire screen
        await execAsync(`screencapture -x "${outputPath}"`);
      }
    } else {
      // Capture entire screen
      await execAsync(`screencapture -x "${outputPath}"`);
    }
    
    const data = fs.readFileSync(outputPath);
    return {
      success: true,
      path: outputPath,
      image: data.toString('base64'),
      format: 'png',
      platform: 'macos',
      note: appName ? `Captured ${appName} app` : 'Captured screen',
    };
  } else {
    // Android
    deviceId = deviceId || await getBootedAndroidEmulator() || undefined;
    if (!deviceId) throw new Error('No running Android Emulator found');
    
    const tmpPath = '/sdcard/screenshot.png';
    await execAsync(`adb -s ${deviceId} shell screencap -p ${tmpPath}`);
    await execAsync(`adb -s ${deviceId} pull ${tmpPath} "${outputPath}"`);
    await execAsync(`adb -s ${deviceId} shell rm ${tmpPath}`);
    
    const data = fs.readFileSync(outputPath);
    return {
      success: true,
      path: outputPath,
      image: data.toString('base64'),
      format: 'png',
    };
  }
}

// Video recording state
const recordingProcesses: Map<string, { process: ReturnType<typeof spawn>; outputPath: string }> = new Map();

async function recordVideo(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const action = params.action as string;
  let deviceId = params.deviceId as string | undefined;
  const outputPath = params.outputPath as string || path.join(os.tmpdir(), `recording_${Date.now()}.mp4`);
  
  if (platform === 'ios') {
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    if (action === 'start') {
      const child = spawn('xcrun', ['simctl', 'io', deviceId, 'recordVideo', outputPath]);
      recordingProcesses.set(deviceId, { process: child, outputPath });
      return { success: true, message: 'Recording started', outputPath };
    } else {
      const recording = recordingProcesses.get(deviceId);
      if (recording) {
        recording.process.kill('SIGINT');
        recordingProcesses.delete(deviceId);
        return { success: true, message: 'Recording stopped', path: recording.outputPath };
      }
      return { success: false, message: 'No recording in progress' };
    }
  } else if (platform === 'macos') {
    const recordId = 'macos_screen';
    
    if (action === 'start') {
      // Use screencapture for video recording on macOS
      // -v = video mode, -V = video duration (we use process kill to stop)
      const child = spawn('screencapture', ['-v', outputPath]);
      recordingProcesses.set(recordId, { process: child, outputPath });
      return { 
        success: true, 
        message: 'Screen recording started. Click on a window to record it, or press Space then click to record entire screen.',
        outputPath,
        platform: 'macos',
        note: 'Use simulator_record with action: "stop" to finish recording'
      };
    } else {
      const recording = recordingProcesses.get(recordId);
      if (recording) {
        recording.process.kill('SIGINT');
        recordingProcesses.delete(recordId);
        // Wait a moment for file to be written
        await new Promise(r => setTimeout(r, 1000));
        return { success: true, message: 'Recording stopped', path: recording.outputPath, platform: 'macos' };
      }
      return { success: false, message: 'No recording in progress', platform: 'macos' };
    }
  } else {
    // Android
    deviceId = deviceId || await getBootedAndroidEmulator() || undefined;
    if (!deviceId) throw new Error('No running Android Emulator found');
    
    if (action === 'start') {
      const child = spawn('adb', ['-s', deviceId, 'shell', 'screenrecord', '/sdcard/recording.mp4']);
      recordingProcesses.set(deviceId, { process: child, outputPath });
      return { success: true, message: 'Recording started (max 3 min)', outputPath };
    } else {
      const recording = recordingProcesses.get(deviceId);
      if (recording) {
        recording.process.kill('SIGINT');
        recordingProcesses.delete(deviceId);
        
        // Pull the recording
        await new Promise(r => setTimeout(r, 1000));
        await execAsync(`adb -s ${deviceId} pull /sdcard/recording.mp4 "${recording.outputPath}"`);
        await execAsync(`adb -s ${deviceId} shell rm /sdcard/recording.mp4`);
        
        return { success: true, message: 'Recording stopped', path: recording.outputPath };
      }
      return { success: false, message: 'No recording in progress' };
    }
  }
}

async function openUrl(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const url = params.url as string;
  const appName = params.appName as string | undefined;
  let deviceId = params.deviceId as string | undefined;
  
  if (platform === 'ios') {
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    await execAsync(`xcrun simctl openurl "${deviceId}" "${url}"`);
    return { success: true, message: `Opened URL: ${url}` };
  } else if (platform === 'macos') {
    let cmd = `open "${url}"`;
    if (appName) {
      cmd = `open -a "${appName}" "${url}"`;
    }
    
    await execAsync(cmd);
    return { success: true, message: `Opened URL: ${url}`, platform: 'macos', app: appName || 'default browser' };
  } else {
    // Android
    deviceId = deviceId || await getBootedAndroidEmulator() || undefined;
    if (!deviceId) throw new Error('No running Android Emulator found');
    
    await execAsync(`adb -s ${deviceId} shell am start -a android.intent.action.VIEW -d "${url}"`);
    return { success: true, message: `Opened URL: ${url}` };
  }
}

async function pushNotification(params: Record<string, unknown>): Promise<unknown> {
  const bundleId = params.bundleId as string;
  const payload = params.payload as Record<string, unknown>;
  let deviceId = params.deviceId as string | undefined;
  
  deviceId = deviceId || await getBootedIOSSimulator() || undefined;
  if (!deviceId) throw new Error('No booted iOS Simulator found');
  
  // Create temp payload file
  const payloadPath = path.join(os.tmpdir(), `push_${Date.now()}.json`);
  const apnsPayload = {
    'Simulator Target Bundle': bundleId,
    aps: payload,
  };
  
  fs.writeFileSync(payloadPath, JSON.stringify(apnsPayload, null, 2));
  
  await execAsync(`xcrun simctl push "${deviceId}" "${bundleId}" "${payloadPath}"`);
  fs.unlinkSync(payloadPath);
  
  return { success: true, message: 'Push notification sent', payload };
}

async function setLocation(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const latitude = params.latitude as number;
  const longitude = params.longitude as number;
  let deviceId = params.deviceId as string | undefined;
  
  if (platform === 'ios') {
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    await execAsync(`xcrun simctl location "${deviceId}" set ${latitude},${longitude}`);
    return { success: true, message: `Location set to ${latitude}, ${longitude}` };
  } else {
    deviceId = deviceId || await getBootedAndroidEmulator() || undefined;
    if (!deviceId) throw new Error('No running Android Emulator found');
    
    await execAsync(`adb -s ${deviceId} emu geo fix ${longitude} ${latitude}`);
    return { success: true, message: `Location set to ${latitude}, ${longitude}` };
  }
}

async function getAppContainer(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const bundleId = params.bundleId as string;
  const container = params.container as string || 'data';
  let deviceId = params.deviceId as string | undefined;
  
  if (platform === 'ios') {
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    const { stdout } = await execAsync(`xcrun simctl get_app_container "${deviceId}" "${bundleId}" ${container}`);
    return { path: stdout.trim(), container, bundleId };
  } else {
    deviceId = deviceId || await getBootedAndroidEmulator() || undefined;
    if (!deviceId) throw new Error('No running Android Emulator found');
    
    return {
      path: `/data/data/${bundleId}`,
      note: 'Android app data directory (requires root access to read)',
      bundleId,
    };
  }
}

async function clearAppData(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const bundleId = params.bundleId as string;
  let deviceId = params.deviceId as string | undefined;
  
  if (platform === 'ios') {
    // iOS doesn't have a direct clear data command, need to uninstall/reinstall
    return {
      success: false,
      message: 'iOS requires uninstall/reinstall to clear data. Use uninstall_app then install_app.',
    };
  } else {
    deviceId = deviceId || await getBootedAndroidEmulator() || undefined;
    if (!deviceId) throw new Error('No running Android Emulator found');
    
    await execAsync(`adb -s ${deviceId} shell pm clear ${bundleId}`);
    return { success: true, message: `Cleared data for ${bundleId}` };
  }
}

async function getDeviceLogs(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const filter = params.filter as string | undefined;
  const lines = params.lines as number || 100;
  let deviceId = params.deviceId as string | undefined;
  
  if (platform === 'ios') {
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    let cmd = `xcrun simctl spawn "${deviceId}" log stream --level=debug --style=compact`;
    if (filter) {
      cmd += ` --predicate 'eventMessage CONTAINS "${filter}"'`;
    }
    cmd += ` 2>&1 | head -${lines}`;
    
    // Use a timeout since log stream is continuous
    try {
      const { stdout } = await execAsync(cmd, { timeout: 3000 });
      return { logs: stdout.split('\n').filter(Boolean), count: lines };
    } catch {
      return { logs: [], message: 'Log stream timed out or no matching logs' };
    }
  } else {
    deviceId = deviceId || await getBootedAndroidEmulator() || undefined;
    if (!deviceId) throw new Error('No running Android Emulator found');
    
    let cmd = `adb -s ${deviceId} logcat -d -t ${lines}`;
    if (filter) {
      cmd += ` | grep -i "${filter}"`;
    }
    
    const { stdout } = await execAsync(cmd);
    return { logs: stdout.split('\n').filter(Boolean), count: lines };
  }
}

// MARK: - macOS Specific Functions

async function listRunningApps(params: Record<string, unknown>): Promise<unknown> {
  const filter = params.filter as string | undefined;
  
  try {
    // Use ps command to get running apps
    const apps: Array<{ name: string; bundleId: string; pid: number }> = [];
    const { stdout: psOutput } = await execAsync('ps aux | grep -E "\\.app/Contents/MacOS" | grep -v grep');
    const lines = psOutput.trim().split('\n').filter(Boolean);
    
    for (const line of lines) {
      const parts = line.split(/\s+/);
      const pid = parseInt(parts[1], 10);
      const appPath = parts.slice(10).join(' ');
      const appMatch = appPath.match(/([^/]+)\.app/);
      const appName = appMatch ? appMatch[1] : path.basename(appPath);
      
      if (!filter || appName.toLowerCase().includes(filter.toLowerCase())) {
        apps.push({ name: appName, bundleId: appPath, pid });
      }
    }
    
    return {
      success: true,
      apps,
      count: apps.length,
      platform: 'macos',
    };
  } catch {
    // Fallback to simpler approach
    const { stdout } = await execAsync('ls /Applications | grep -E "\\.app$" | sed "s/.app$//"');
    const installedApps = stdout.trim().split('\n').filter(Boolean);
    
    return {
      success: true,
      note: 'Showing installed apps (could not get running apps)',
      apps: installedApps.filter(app => !filter || app.toLowerCase().includes(filter.toLowerCase())),
      platform: 'macos',
    };
  }
}

async function buildMacOSApp(params: Record<string, unknown>): Promise<unknown> {
  const projectPath = params.projectPath as string;
  const scheme = params.scheme as string | undefined;
  const configuration = (params.configuration as string) || 'debug';
  
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }
  
  // Check for Swift Package Manager project
  const packageSwiftPath = path.join(projectPath, 'Package.swift');
  const hasPackageSwift = fs.existsSync(packageSwiftPath);
  
  // Check for Xcode project
  const files = fs.readdirSync(projectPath);
  const xcodeproj = files.find(f => f.endsWith('.xcodeproj'));
  const xcworkspace = files.find(f => f.endsWith('.xcworkspace'));
  
  if (hasPackageSwift) {
    // Build with Swift Package Manager
    const config = configuration === 'release' ? '--configuration release' : '';
    const cmd = `cd "${projectPath}" && swift build ${config}`;
    
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 });
      return {
        success: true,
        buildSystem: 'swift-package-manager',
        configuration,
        output: stdout + stderr,
        platform: 'macos',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Build failed';
      return {
        success: false,
        buildSystem: 'swift-package-manager',
        error: message,
        platform: 'macos',
      };
    }
  } else if (xcworkspace || xcodeproj) {
    // Build with xcodebuild
    const projectFile = xcworkspace || xcodeproj!;
    const project = xcworkspace 
      ? `-workspace "${path.join(projectPath, projectFile)}"`
      : `-project "${path.join(projectPath, projectFile)}"`;
    
    const schemeName = scheme || projectFile.replace(/\.(xcworkspace|xcodeproj)$/, '') || 'App';
    const config = configuration === 'release' ? 'Release' : 'Debug';
    
    const cmd = `xcodebuild ${project} -scheme "${schemeName}" -configuration ${config} -destination 'platform=macOS' build`;
    
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 600000 });
      return {
        success: true,
        buildSystem: 'xcodebuild',
        scheme: schemeName,
        configuration: config,
        output: (stdout + stderr).slice(-2000), // Last 2000 chars
        platform: 'macos',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Build failed';
      return {
        success: false,
        buildSystem: 'xcodebuild',
        error: message.slice(-2000),
        platform: 'macos',
      };
    }
  } else {
    throw new Error('No Package.swift, .xcodeproj, or .xcworkspace found in project directory');
  }
}

async function runMacOSApp(params: Record<string, unknown>): Promise<unknown> {
  const projectPath = params.projectPath as string;
  const scheme = params.scheme as string | undefined;
  const args = params.arguments as string[] | undefined;
  
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }
  
  // First, build the app
  const buildResult = await buildMacOSApp({ projectPath, scheme, configuration: 'debug' }) as { success: boolean; buildSystem?: string; error?: string };
  
  if (!buildResult.success) {
    return {
      success: false,
      phase: 'build',
      error: buildResult.error,
      platform: 'macos',
    };
  }
  
  // Find and run the built app
  const packageSwiftPath = path.join(projectPath, 'Package.swift');
  const hasPackageSwift = fs.existsSync(packageSwiftPath);
  
  if (hasPackageSwift) {
    // Run with swift run
    let cmd = `cd "${projectPath}" && swift run`;
    if (args?.length) {
      cmd += ' -- ' + args.map(a => `"${a}"`).join(' ');
    }
    
    try {
      // Start the process in background
      const child = spawn('sh', ['-c', cmd], { 
        detached: true, 
        stdio: 'ignore',
        cwd: projectPath,
      });
      child.unref();
      
      return {
        success: true,
        phase: 'run',
        buildSystem: 'swift-package-manager',
        message: 'App started in background',
        pid: child.pid,
        platform: 'macos',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Run failed';
      return {
        success: false,
        phase: 'run',
        error: message,
        platform: 'macos',
      };
    }
  } else {
    // For Xcode projects, find the built .app and open it
    const files = fs.readdirSync(projectPath);
    const xcodeproj = files.find(f => f.endsWith('.xcodeproj'));
    const appName = scheme || xcodeproj?.replace('.xcodeproj', '') || 'App';
    
    // Look for the app in DerivedData
    const derivedDataPath = path.join(os.homedir(), 'Library/Developer/Xcode/DerivedData');
    
    try {
      const { stdout } = await execAsync(`find "${derivedDataPath}" -name "${appName}.app" -path "*/Debug/*" 2>/dev/null | head -1`);
      const appPath = stdout.trim();
      
      if (appPath) {
        let cmd = `open "${appPath}"`;
        if (args?.length) {
          cmd += ' --args ' + args.map(a => `"${a}"`).join(' ');
        }
        
        await execAsync(cmd);
        return {
          success: true,
          phase: 'run',
          buildSystem: 'xcodebuild',
          appPath,
          message: 'App launched',
          platform: 'macos',
        };
      } else {
        return {
          success: false,
          phase: 'run',
          error: `Could not find built app: ${appName}.app`,
          hint: 'Try building first, then launch manually',
          platform: 'macos',
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Run failed';
      return {
        success: false,
        phase: 'run',
        error: message,
        platform: 'macos',
      };
    }
  }
}
