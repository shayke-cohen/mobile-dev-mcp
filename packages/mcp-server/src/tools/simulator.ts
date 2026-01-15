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
    description: 'Launch an app on simulator/emulator',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
        },
        deviceId: {
          type: 'string',
          description: 'Target device ID (optional)',
        },
        bundleId: {
          type: 'string',
          description: 'App bundle ID (iOS) or package name (Android)',
        },
        arguments: {
          type: 'array',
          items: { type: 'string' },
          description: 'Launch arguments',
        },
      },
      required: ['platform', 'bundleId'],
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
          enum: ['ios', 'android'],
        },
        deviceId: {
          type: 'string',
        },
        bundleId: {
          type: 'string',
          description: 'App bundle ID or package name',
        },
      },
      required: ['platform', 'bundleId'],
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
    description: 'Start/stop video recording of simulator',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
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
    description: 'Open a URL in the simulator/emulator',
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
        url: {
          type: 'string',
          description: 'URL to open (can be deep link)',
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
  } catch (error) {
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
  const bundleId = params.bundleId as string;
  let deviceId = params.deviceId as string | undefined;
  const args = params.arguments as string[] | undefined;
  
  if (platform === 'ios') {
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    let cmd = `xcrun simctl launch "${deviceId}" "${bundleId}"`;
    if (args?.length) {
      cmd += ' ' + args.map(a => `"${a}"`).join(' ');
    }
    
    await execAsync(cmd);
    return { success: true, message: `Launched ${bundleId} on iOS Simulator` };
  } else {
    deviceId = deviceId || await getBootedAndroidEmulator() || undefined;
    if (!deviceId) throw new Error('No running Android Emulator found');
    
    await execAsync(`adb -s ${deviceId} shell monkey -p ${bundleId} 1`);
    return { success: true, message: `Launched ${bundleId} on Android Emulator` };
  }
}

async function terminateApp(params: Record<string, unknown>): Promise<unknown> {
  const platform = params.platform as string;
  const bundleId = params.bundleId as string;
  let deviceId = params.deviceId as string | undefined;
  
  if (platform === 'ios') {
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    await execAsync(`xcrun simctl terminate "${deviceId}" "${bundleId}"`);
    return { success: true, message: `Terminated ${bundleId}` };
  } else {
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
  } else {
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
  let deviceId = params.deviceId as string | undefined;
  
  if (platform === 'ios') {
    deviceId = deviceId || await getBootedIOSSimulator() || undefined;
    if (!deviceId) throw new Error('No booted iOS Simulator found');
    
    await execAsync(`xcrun simctl openurl "${deviceId}" "${url}"`);
    return { success: true, message: `Opened URL: ${url}` };
  } else {
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
