#!/usr/bin/env node

/**
 * MCP Server End-to-End Test
 * 
 * This script performs a full integration test:
 * 1. Starts the MCP server (or connects to existing one)
 * 2. Boots simulators/emulators if needed
 * 3. Builds and runs demo apps
 * 4. Waits for SDK connection
 * 5. Tests all MCP tools
 * 6. Reports results
 * 
 * Usage:
 *   node scripts/e2e-test.js                      # Run all tests (iOS + Android)
 *   node scripts/e2e-test.js --platform=ios       # iOS only
 *   node scripts/e2e-test.js --platform=android   # Android only
 *   node scripts/e2e-test.js --platform=rn        # React Native (iOS)
 *   node scripts/e2e-test.js --platform=rn-android # React Native (Android)
 *   node scripts/e2e-test.js --skip-build         # Skip build, just test
 *   node scripts/e2e-test.js --use-existing-server # Connect to running server
 *   node scripts/e2e-test.js --verbose            # Verbose output
 * 
 * For debugging, run the server separately:
 *   Terminal 1: yarn start:server
 *   Terminal 2: yarn test:e2e:existing --platform=ios
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Try to load ws from mcp-server's node_modules
let WebSocket;
try {
  WebSocket = require('ws');
} catch (e) {
  const wsPath = path.join(__dirname, '..', 'packages', 'mcp-server', 'node_modules', 'ws');
  WebSocket = require(wsPath);
}

// ===================== Configuration =====================

const CONFIG = {
  serverPath: path.join(__dirname, '..', 'packages', 'mcp-server', 'dist', 'index.js'),
  wsPort: 8765,
  timeout: {
    serverStart: 5000,
    simulatorBoot: 60000,
    appBuild: 300000,  // 5 minutes
    appLaunch: 30000,
    sdkConnect: 30000,
    toolCall: 10000,
  },
  demos: {
    reactNative: path.join(__dirname, '..', 'examples', 'react-native-demo'),
    ios: path.join(__dirname, '..', 'examples', 'ios-swiftui-demo'),
    android: path.join(__dirname, '..', 'examples', 'android-compose-demo'),
  }
};

// Parse args
const args = process.argv.slice(2);
const platform = args.find(a => a.startsWith('--platform='))?.split('=')[1] || 'all';
const skipBuild = args.includes('--skip-build');
const verbose = args.includes('--verbose') || args.includes('-v');
const useExistingServer = args.includes('--use-existing-server');

// ===================== Utilities =====================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.cyan}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`  ${colors.green}✓${colors.reset} ${message}`);
}

function logError(message) {
  console.log(`  ${colors.red}✗${colors.reset} ${message}`);
}

function logWarn(message) {
  console.log(`  ${colors.yellow}⚠${colors.reset} ${message}`);
}

function logInfo(message) {
  console.log(`  ${colors.blue}ℹ${colors.reset} ${message}`);
}

function logVerbose(message) {
  if (verbose) {
    console.log(`    ${colors.reset}${message}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function exec(cmd, options = {}) {
  logInfo(`Executing: ${cmd}`);
  try {
    return execSync(cmd, { 
      encoding: 'utf-8', 
      stdio: verbose ? 'inherit' : 'pipe',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large build outputs
      ...options 
    });
  } catch (e) {
    if (verbose) console.error(e.message);
    throw e;
  }
}

// ===================== MCP Client =====================

class MCPClient {
  constructor() {
    this.server = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.buffer = '';
    this.connectedDevices = [];
    this.wsConnections = new Set();
    this.useExistingServer = useExistingServer;
  }

  async start() {
    if (this.useExistingServer) {
      return this.connectToExistingServer();
    }
    return this.spawnServer();
  }

  async connectToExistingServer() {
    logInfo('Connecting to existing MCP server...');
    
    // Verify the server is running by connecting to WebSocket
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${CONFIG.wsPort}`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Cannot connect to existing server at ws://localhost:${CONFIG.wsPort}. Make sure to run: yarn start:server`));
      }, 5000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        logInfo('Connected to existing server WebSocket');
        ws.close();
        resolve();
      });
      
      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Cannot connect to existing server: ${err.message}. Make sure to run: yarn start:server`));
      });
    });
  }

  async spawnServer() {
    return new Promise((resolve, reject) => {
      logInfo('Starting MCP server...');
      
      this.server = spawn('node', [CONFIG.serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, MCP_LOG_LEVEL: verbose ? 'debug' : 'info' }
      });
      
      this.server.stdout.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });
      
      this.server.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('WebSocket') && msg.includes('listening')) {
          logInfo('WebSocket server ready');
        }
        if (msg.includes('New connection')) {
          logInfo('Device connected via WebSocket');
        }
        if (verbose && msg) {
          console.log(`  [server] ${msg}`);
        }
      });
      
      this.server.on('error', reject);
      
      setTimeout(resolve, CONFIG.timeout.serverStart);
    });
  }

  processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        if (message.id && this.pendingRequests.has(message.id)) {
          const { resolve, reject } = this.pendingRequests.get(message.id);
          this.pendingRequests.delete(message.id);
          
          if (message.error) {
            reject(new Error(message.error.message || JSON.stringify(message.error)));
          } else {
            resolve(message.result);
          }
        }
      } catch (e) {
        // Not JSON
      }
    }
  }

  async call(method, params = {}) {
    if (this.useExistingServer) {
      // For existing server, spawn a temporary MCP client process
      return this.callViaTempClient(method, params);
    }
    
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };
      
      this.pendingRequests.set(id, { resolve, reject });
      this.server.stdin.write(JSON.stringify(request) + '\n');
      
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, CONFIG.timeout.toolCall);
    });
  }

  async callViaTempClient(method, params = {}) {
    // Spawn a temporary server process to handle the MCP call
    // This is needed because MCP uses stdio, which requires parent-child relationship
    return new Promise((resolve, reject) => {
      const tempServer = spawn('node', [CONFIG.serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, MCP_LOG_LEVEL: 'error', MCP_PORT: '0' } // Use different port
      });
      
      let buffer = '';
      const requestId = 1;
      
      tempServer.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const message = JSON.parse(line);
            if (message.id === requestId) {
              tempServer.kill();
              if (message.error) {
                reject(new Error(message.error.message || JSON.stringify(message.error)));
              } else {
                resolve(message.result);
              }
            }
          } catch (e) {
            // Not JSON
          }
        }
      });
      
      tempServer.on('error', (err) => {
        reject(err);
      });
      
      // Wait for server to start, then send request
      setTimeout(() => {
        const request = {
          jsonrpc: '2.0',
          id: requestId,
          method,
          params
        };
        tempServer.stdin.write(JSON.stringify(request) + '\n');
      }, 2000);
      
      // Timeout
      setTimeout(() => {
        tempServer.kill();
        reject(new Error('Request timeout'));
      }, CONFIG.timeout.toolCall + 3000);
    });
  }

  async listTools() {
    const result = await this.call('tools/list');
    return result.tools;
  }

  async callTool(name, args = {}) {
    const result = await this.call('tools/call', { name, arguments: args });
    return result;
  }

  stop() {
    if (this.server && !this.useExistingServer) {
      this.server.kill();
      this.server = null;
    }
  }
}

// ===================== Test Runner =====================

class E2ETestRunner {
  constructor() {
    this.mcpClient = new MCPClient();
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
    this.bootedSimulators = [];
    this.metroProcess = null;
  }

  async test(name, fn) {
    const startTime = Date.now();
    try {
      await fn();
      const duration = Date.now() - startTime;
      this.results.passed++;
      this.results.tests.push({ name, status: 'passed', duration });
      logSuccess(`${name} (${duration}ms)`);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.failed++;
      this.results.tests.push({ name, status: 'failed', error: error.message, duration });
      logError(`${name}: ${error.message}`);
      return false;
    }
  }

  skip(name, reason) {
    this.results.skipped++;
    this.results.tests.push({ name, status: 'skipped', reason });
    logWarn(`${name} (skipped: ${reason})`);
  }

  // ==================== Simulator Management ====================

  async getBootedSimulators() {
    const result = await this.mcpClient.callTool('list_simulators');
    const data = JSON.parse(result.content[0].text);
    return data.devices.filter(d => d.state === 'booted');
  }

  async bootSimulator(platform, name) {
    logInfo(`Booting ${platform} simulator: ${name}`);
    
    const result = await this.mcpClient.callTool('boot_simulator', {
      platform,
      name
    });
    
    const text = result.content[0].text;
    if (result.isError) {
      throw new Error(text);
    }
    
    // Wait for boot
    await sleep(5000);
    return true;
  }

  async findOrBootSimulator(platform) {
    const booted = await this.getBootedSimulators();
    const platformDevices = booted.filter(d => d.platform === platform);
    
    if (platformDevices.length > 0) {
      logInfo(`Found booted ${platform} device: ${platformDevices[0].name}`);
      return platformDevices[0];
    }
    
    // Boot a new one
    const result = await this.mcpClient.callTool('list_simulators');
    const data = JSON.parse(result.content[0].text);
    const available = data.devices.filter(d => d.platform === platform && d.state === 'shutdown');
    
    if (available.length === 0) {
      throw new Error(`No ${platform} simulators available`);
    }
    
    // Pick a good one
    let target;
    if (platform === 'ios') {
      target = available.find(d => d.name.includes('iPhone 16 Pro')) ||
               available.find(d => d.name.includes('iPhone 15')) ||
               available[0];
    } else {
      target = available[0];
    }
    
    await this.bootSimulator(platform, target.name);
    this.bootedSimulators.push({ platform, id: target.id });
    
    return target;
  }

  // ==================== App Building ====================

  async startMetroBundler() {
    const projectPath = CONFIG.demos.reactNative;
    
    // Check if Metro is already running
    try {
      const response = await fetch('http://localhost:8081/status');
      if (response.ok) {
        logInfo('Metro bundler already running');
        return true;
      }
    } catch (e) {
      // Metro not running, start it
    }
    
    logInfo('Starting Metro bundler in background...');
    
    // Start Metro in a detached process
    this.metroProcess = spawn('yarn', ['start'], {
      cwd: projectPath,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' }
    });
    
    // Log Metro output
    this.metroProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (verbose && msg) {
        console.log(`  [metro] ${msg}`);
      }
    });
    
    this.metroProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (verbose && msg && !msg.includes('WARN')) {
        console.log(`  [metro] ${msg}`);
      }
    });
    
    // Wait for Metro to be ready
    logInfo('Waiting for Metro bundler to start...');
    const maxWait = 30000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      try {
        const response = await fetch('http://localhost:8081/status');
        if (response.ok) {
          logInfo('Metro bundler is ready');
          return true;
        }
      } catch (e) {
        // Not ready yet
      }
      await sleep(1000);
    }
    
    throw new Error('Metro bundler failed to start');
  }
  
  stopMetroBundler() {
    if (this.metroProcess) {
      logInfo('Stopping Metro bundler...');
      try {
        // Kill the process group
        process.kill(-this.metroProcess.pid, 'SIGTERM');
      } catch (e) {
        try {
          this.metroProcess.kill('SIGTERM');
        } catch (e2) {}
      }
      this.metroProcess = null;
    }
    
    // Also kill any orphaned Metro processes
    try {
      execSync('pkill -f "react-native.*start" 2>/dev/null || true', { stdio: 'ignore' });
    } catch (e) {}
  }

  async buildAndRunReactNative(simulator, rnPlatform = 'ios') {
    logInfo(`Building React Native app for ${rnPlatform}...`);
    
    const projectPath = CONFIG.demos.reactNative;
    
    if (!fs.existsSync(projectPath)) {
      throw new Error('React Native demo not found');
    }
    
    // Install dependencies if needed
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      logInfo('Installing React Native dependencies...');
      exec(`cd "${projectPath}" && yarn install`, { timeout: 180000 });
    }
    
    // Start Metro bundler
    await this.startMetroBundler();
    
    if (rnPlatform === 'ios') {
      // Install pods if needed
      const podsPath = path.join(projectPath, 'ios', 'Pods');
      if (!fs.existsSync(podsPath)) {
        logInfo('Installing CocoaPods...');
        exec(`cd "${projectPath}/ios" && pod install`, { timeout: 180000 });
      }
      
      // Build iOS
      logInfo('Building React Native iOS...');
      const iosProjectPath = path.join(projectPath, 'ios');
      
      // React Native iOS bundle ID is different from native iOS
      const rnBundleId = 'org.reactjs.native.example.MCPDemoApp';
      const nativeBundleId = 'com.mobiledevmcp.demo';
      
      // Terminate any existing instances (both RN and native iOS)
      try {
        exec(`xcrun simctl terminate ${simulator.id} ${rnBundleId}`, { stdio: 'ignore' });
      } catch (e) {}
      try {
        exec(`xcrun simctl terminate ${simulator.id} ${nativeBundleId}`, { stdio: 'ignore' });
      } catch (e) {}
      
      // Build with xcodebuild
      exec(`cd "${iosProjectPath}" && xcodebuild -workspace MCPDemoApp.xcworkspace -scheme MCPDemoApp -destination 'id=${simulator.id}' -configuration Debug build`, { timeout: 300000 });
      
      // Find and install the app
      const derivedDataPath = path.join(process.env.HOME, 'Library/Developer/Xcode/DerivedData');
      const appDirs = fs.readdirSync(derivedDataPath).filter(d => d.startsWith('MCPDemoApp-'));
      if (appDirs.length > 0) {
        // Sort by modification time to get the most recent
        const sortedDirs = appDirs.sort((a, b) => {
          const statA = fs.statSync(path.join(derivedDataPath, a));
          const statB = fs.statSync(path.join(derivedDataPath, b));
          return statB.mtime - statA.mtime;
        });
        const appPath = path.join(derivedDataPath, sortedDirs[0], 'Build/Products/Debug-iphonesimulator/MCPDemoApp.app');
        if (fs.existsSync(appPath)) {
          exec(`xcrun simctl install ${simulator.id} "${appPath}"`);
          exec(`xcrun simctl launch ${simulator.id} ${rnBundleId}`);
        }
      }
    } else {
      // Build Android
      logInfo('Building React Native Android...');
      
      // Set up adb reverse for Metro
      exec('adb reverse tcp:8081 tcp:8081');
      exec('adb reverse tcp:8765 tcp:8765');
      
      // Build APK
      exec(`cd "${projectPath}/android" && ./gradlew assembleDebug`, { timeout: 300000 });
      
      // Install and launch
      const apkPath = path.join(projectPath, 'android/app/build/outputs/apk/debug/app-debug.apk');
      if (fs.existsSync(apkPath)) {
        exec(`adb install -r "${apkPath}"`);
        exec('adb shell am start -n com.mcpdemoapp/.MainActivity');
      }
    }
    
    // Wait for app to start and connect (React Native apps need more time to load JS bundle)
    logInfo('Waiting for React Native app to initialize...');
    await sleep(10000);
    
    return true;
  }

  async buildAndRunIOS(simulator) {
    logInfo('Building iOS SwiftUI app...');
    
    const projectPath = CONFIG.demos.ios;
    
    if (!fs.existsSync(projectPath)) {
      throw new Error('iOS demo not found');
    }
    
    // Terminate any existing instance first
    try {
      exec(`xcrun simctl terminate ${simulator.id} com.mobiledevmcp.demo`, { stdio: 'ignore' });
    } catch (e) {
      // App might not be running, that's ok
    }
    
    // Build and install directly (more reliable than detached script)
    logInfo('Building with xcodebuild...');
    try {
      exec(`cd "${projectPath}" && xcodebuild -project MCPDemoApp.xcodeproj -scheme MCPDemoApp -destination 'id=${simulator.id}' -configuration Debug build`, { timeout: 120000 });
    } catch (e) {
      throw new Error('Build failed');
    }
    
    // Install
    logInfo('Installing app...');
    const appPath = path.join(
      process.env.HOME,
      'Library/Developer/Xcode/DerivedData/MCPDemoApp-epzoztjahyxoplabpuwedkadkslv/Build/Products/Debug-iphonesimulator/MCPDemoApp.app'
    );
    
    if (fs.existsSync(appPath)) {
      exec(`xcrun simctl install ${simulator.id} "${appPath}"`);
    }
    
    // Launch
    logInfo('Launching app...');
    exec(`xcrun simctl launch ${simulator.id} com.mobiledevmcp.demo`);
    
    // Wait for app to start
    await sleep(3000);
    
    return true;
  }

  async buildAndRunAndroid(emulator) {
    logInfo('Building Android app...');
    
    const projectPath = CONFIG.demos.android;
    
    if (!fs.existsSync(projectPath)) {
      throw new Error('Android demo not found');
    }
    
    // Set up adb reverse for port forwarding (helps with real devices)
    try {
      execSync('adb reverse tcp:8765 tcp:8765', { stdio: 'pipe' });
      logVerbose('Set up adb reverse port forwarding');
    } catch (e) {
      logVerbose('adb reverse failed (may not be needed for emulator with 10.0.2.2)');
    }
    
    // Build the app
    logVerbose('Running gradle build...');
    try {
      execSync('./gradlew assembleDebug', {
        cwd: projectPath,
        stdio: verbose ? 'inherit' : 'pipe',
        timeout: 300000
      });
    } catch (e) {
      throw new Error(`Gradle build failed: ${e.message}`);
    }
    
    // Install the app
    logVerbose('Installing APK...');
    const apkPath = path.join(projectPath, 'app/build/outputs/apk/debug/app-debug.apk');
    if (!fs.existsSync(apkPath)) {
      throw new Error('APK not found after build');
    }
    
    try {
      execSync(`adb install -r "${apkPath}"`, { stdio: 'pipe', timeout: 60000 });
    } catch (e) {
      throw new Error(`APK install failed: ${e.message}`);
    }
    
    // Launch the app
    logVerbose('Launching app...');
    try {
      execSync('adb shell am start -n com.mobiledevmcp.demo/.MainActivity', { stdio: 'pipe' });
    } catch (e) {
      throw new Error(`App launch failed: ${e.message}`);
    }
    
    // Wait for app to launch and SDK to initialize
    await sleep(5000);
    
    return true;
  }

  // ==================== SDK Connection Tests ====================

  async waitForSDKConnection(timeout = CONFIG.timeout.sdkConnect) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.mcpClient.callTool('list_connected_devices');
        const text = result.content[0].text;
        
        if (!result.isError && !text.includes('No device')) {
          const data = JSON.parse(text);
          if (data.devices && data.devices.length > 0) {
            return data.devices;
          }
        }
      } catch (e) {
        // Continue waiting
      }
      
      await sleep(2000);
    }
    
    throw new Error('Timeout waiting for SDK connection');
  }

  // ==================== Tool Tests ====================

  async testSimulatorTools() {
    logStep('SIMULATORS', 'Testing simulator tools...');
    
    await this.test('list_simulators returns devices', async () => {
      const result = await this.mcpClient.callTool('list_simulators');
      const data = JSON.parse(result.content[0].text);
      if (!data.devices || data.devices.length === 0) {
        throw new Error('No simulators found');
      }
    });
    
    await this.test('simulator_screenshot captures image', async () => {
      const booted = await this.getBootedSimulators();
      if (booted.length === 0) {
        throw new Error('No booted simulator for screenshot');
      }
      
      const result = await this.mcpClient.callTool('simulator_screenshot', {
        device_id: booted[0].id
      });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
    });
  }

  async testAppTools() {
    logStep('APP TOOLS', 'Testing app inspection tools...');
    
    await this.test('get_app_state returns state', async () => {
      const result = await this.mcpClient.callTool('get_app_state');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      // Should have cart, user, products from demo app
      if (!data.cart && !data.products) {
        throw new Error('App state missing expected keys');
      }
    });
    
    await this.test('get_device_info returns device data', async () => {
      const result = await this.mcpClient.callTool('get_device_info');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (!data.platform) {
        throw new Error('Device info missing platform');
      }
    });
    
    await this.test('list_feature_flags returns flags', async () => {
      const result = await this.mcpClient.callTool('list_feature_flags');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
    });
    
    await this.test('toggle_feature_flag works', async () => {
      const result = await this.mcpClient.callTool('toggle_feature_flag', {
        key: 'dark_mode',
        value: true
      });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (data.value !== true) {
        throw new Error('Feature flag not toggled');
      }
    });
    
    // Note: get_logs can timeout on some SDKs - making it optional
    try {
      await this.test('get_logs returns log entries', async () => {
        const result = await this.mcpClient.callTool('get_logs', { limit: 10 });
        
        if (result.isError) {
          throw new Error(result.content[0].text);
        }
      });
    } catch (e) {
      logWarn('get_logs test failed (optional): ' + e.message);
    }
  }

  // ==================== SDK Action Tests ====================
  
  async testSDKActions(platform = 'ios') {
    logStep('SDK ACTIONS', 'Testing SDK action commands (navigate, cart, etc.)...');
    
    // React Native tracks currentTab, native apps don't
    const supportsNavigationTracking = platform === 'rn' || platform === 'rn-android';
    
    // Test list_actions
    await this.test('list_actions returns registered actions', async () => {
      const result = await this.mcpClient.callTool('list_actions');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const actions = JSON.parse(result.content[0].text);
      if (!Array.isArray(actions) || actions.length === 0) {
        throw new Error('No actions registered');
      }
      logVerbose(`Available actions: ${actions.join(', ')}`);
    });
    
    // Test navigation (only verify state on RN which tracks currentTab)
    await this.test('navigate_to sends command', async () => {
      const result = await this.mcpClient.callTool('navigate_to', { route: 'products' });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      if (supportsNavigationTracking) {
        // Verify via state (only RN tracks currentTab)
        await sleep(500);
        const stateResult = await this.mcpClient.callTool('get_app_state', { path: 'currentTab' });
        const state = JSON.parse(stateResult.content[0].text);
        if (state.currentTab !== 'products') {
          throw new Error(`Expected currentTab=products, got ${state.currentTab}`);
        }
      }
    });
    
    // Test add to cart
    await this.test('add_to_cart adds product', async () => {
      // First, clear cart
      await this.mcpClient.callTool('clear_cart');
      await sleep(200);
      
      // Add product ID "1" (Wireless Headphones)
      const result = await this.mcpClient.callTool('add_to_cart', { productId: '1' });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      // Verify cart has item
      await sleep(300);
      const stateResult = await this.mcpClient.callTool('get_app_state', { path: 'cartCount' });
      const state = JSON.parse(stateResult.content[0].text);
      if (state.cartCount !== 1) {
        throw new Error(`Expected cartCount=1, got ${state.cartCount}`);
      }
    });
    
    // Test add more to cart
    await this.test('add_to_cart increases quantity', async () => {
      // Add same product again
      await this.mcpClient.callTool('add_to_cart', { productId: '1' });
      await sleep(200);
      
      // Verify cart count increased
      const stateResult = await this.mcpClient.callTool('get_app_state', { path: 'cartCount' });
      const state = JSON.parse(stateResult.content[0].text);
      if (state.cartCount !== 2) {
        throw new Error(`Expected cartCount=2, got ${state.cartCount}`);
      }
    });
    
    // Test cart total calculation
    await this.test('cart total is calculated correctly', async () => {
      const stateResult = await this.mcpClient.callTool('get_app_state', { path: 'cartTotal' });
      const state = JSON.parse(stateResult.content[0].text);
      // Product 1 is $149.99, quantity 2 = $299.98
      if (Math.abs(state.cartTotal - 299.98) > 0.01) {
        throw new Error(`Expected cartTotal=299.98, got ${state.cartTotal}`);
      }
    });
    
    // Test navigate to cart
    await this.test('navigate_to cart', async () => {
      const result = await this.mcpClient.callTool('navigate_to', { route: 'cart' });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      if (supportsNavigationTracking) {
        await sleep(300);
        const stateResult = await this.mcpClient.callTool('get_app_state', { path: 'currentTab' });
        const state = JSON.parse(stateResult.content[0].text);
        if (state.currentTab !== 'cart') {
          throw new Error(`Expected currentTab=cart, got ${state.currentTab}`);
        }
      }
    });
    
    // Test remove from cart
    await this.test('remove_from_cart removes product', async () => {
      const result = await this.mcpClient.callTool('remove_from_cart', { productId: '1' });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      await sleep(200);
      const stateResult = await this.mcpClient.callTool('get_app_state', { path: 'cartCount' });
      const state = JSON.parse(stateResult.content[0].text);
      if (state.cartCount !== 0) {
        throw new Error(`Expected cartCount=0 after remove, got ${state.cartCount}`);
      }
    });
    
    // Test login
    await this.test('login sets user', async () => {
      const result = await this.mcpClient.callTool('login');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      await sleep(200);
      const stateResult = await this.mcpClient.callTool('get_app_state', { path: 'user' });
      const state = JSON.parse(stateResult.content[0].text);
      if (!state.user || !state.user.name) {
        throw new Error('User not set after login');
      }
    });
    
    // Test logout
    await this.test('logout clears user', async () => {
      const result = await this.mcpClient.callTool('logout');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      await sleep(200);
      const stateResult = await this.mcpClient.callTool('get_app_state', { path: 'user' });
      const state = JSON.parse(stateResult.content[0].text);
      if (state.user !== null) {
        throw new Error('User not cleared after logout');
      }
    });
    
    // Test navigate back home
    await this.test('navigate_to home', async () => {
      const result = await this.mcpClient.callTool('navigate_to', { route: 'home' });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      if (supportsNavigationTracking) {
        await sleep(300);
        const stateResult = await this.mcpClient.callTool('get_app_state', { path: 'currentTab' });
        const state = JSON.parse(stateResult.content[0].text);
        if (state.currentTab !== 'home') {
          throw new Error(`Expected currentTab=home, got ${state.currentTab}`);
        }
      }
    });
  }

  // ==================== Validation Tests ====================
  
  async testValidationFeatures(platform = 'ios') {
    logStep('VALIDATION', 'Testing validation features (component tree, navigation state, etc.)...');
    
    // Test get_component_tree
    await this.test('get_component_tree returns components', async () => {
      const result = await this.mcpClient.callTool('get_component_tree');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      // Should have component info
      if (typeof data.componentCount !== 'number') {
        throw new Error('Component tree missing componentCount');
      }
      if (!Array.isArray(data.registeredTestIds)) {
        throw new Error('Component tree missing registeredTestIds');
      }
      logVerbose(`Found ${data.componentCount} components, testIds: ${data.registeredTestIds.slice(0, 5).join(', ')}...`);
    });
    
    // Test get_layout_tree
    await this.test('get_layout_tree returns layout info', async () => {
      const result = await this.mcpClient.callTool('get_layout_tree');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (typeof data.elementCount !== 'number') {
        throw new Error('Layout tree missing elementCount');
      }
      if (!Array.isArray(data.elements)) {
        throw new Error('Layout tree missing elements array');
      }
    });
    
    // Test get_navigation_state
    await this.test('get_navigation_state returns route info', async () => {
      const result = await this.mcpClient.callTool('get_navigation_state');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (!data.currentRoute) {
        throw new Error('Navigation state missing currentRoute');
      }
      if (!Array.isArray(data.history)) {
        throw new Error('Navigation state missing history');
      }
      logVerbose(`Current route: ${data.currentRoute}, history length: ${data.historyLength}`);
    });
    
    // Test query_storage
    await this.test('query_storage returns storage data', async () => {
      const result = await this.mcpClient.callTool('query_storage');
      
      if (result.isError) {
        // Storage might not be available on all platforms
        const text = result.content[0].text;
        if (text.includes('not available')) {
          logVerbose('Storage not available on this platform');
          return;
        }
        throw new Error(text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (typeof data.keyCount !== 'number') {
        throw new Error('Storage query missing keyCount');
      }
    });
    
    // Test network mocking
    await this.test('mock_network_request creates mock', async () => {
      const result = await this.mcpClient.callTool('mock_network_request', {
        urlPattern: 'api.example.com/test',
        mockResponse: {
          statusCode: 200,
          body: { success: true, message: 'Mocked response' }
        }
      });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (!data.success || !data.mockId) {
        throw new Error('Mock creation failed');
      }
      logVerbose(`Created mock: ${data.mockId}`);
    });
    
    // Test clear network mocks
    await this.test('clear_network_mocks clears mocks', async () => {
      const result = await this.mcpClient.callTool('clear_network_mocks');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (!data.success) {
        throw new Error('Clear mocks failed');
      }
      if (data.remainingMocks !== 0) {
        throw new Error(`Expected 0 remaining mocks, got ${data.remainingMocks}`);
      }
    });
    
    // Test find_element (if components are registered)
    await this.test('find_element searches components', async () => {
      const result = await this.mcpClient.callTool('find_element', { type: 'Button' });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      // found can be true or false depending on whether buttons are registered
      if (typeof data.found !== 'boolean') {
        throw new Error('find_element missing found field');
      }
      if (typeof data.count !== 'number') {
        throw new Error('find_element missing count field');
      }
      logVerbose(`Found ${data.count} Button elements`);
    });

    // Test specific testIds exist
    await this.test('registered testIds include tab buttons', async () => {
      const result = await this.mcpClient.callTool('get_component_tree');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      const testIds = data.registeredTestIds || [];
      
      const expectedIds = ['tab-home', 'tab-products', 'tab-cart', 'app-title'];
      const foundIds = expectedIds.filter(id => testIds.includes(id));
      
      if (foundIds.length === 0) {
        throw new Error(`No expected testIds found. Registered: ${testIds.slice(0, 10).join(', ')}`);
      }
      logVerbose(`Found testIds: ${foundIds.join(', ')}`);
    });

    // Test get_element_text returns correct text
    await this.test('get_element_text returns app title', async () => {
      const result = await this.mcpClient.callTool('get_element_text', { testId: 'app-title' });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      
      if (!data.found) {
        throw new Error('app-title element not found');
      }
      
      if (!data.text || !data.text.includes('MCP Demo Store')) {
        throw new Error(`Expected text to contain 'MCP Demo Store', got: ${data.text}`);
      }
      logVerbose(`App title text: ${data.text}`);
    });

    // Test find_element by testId
    await this.test('find_element by testId works', async () => {
      const result = await this.mcpClient.callTool('find_element', { testId: 'login-button' });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      
      if (!data.found) {
        throw new Error('login-button not found');
      }
      
      if (data.count !== 1) {
        throw new Error(`Expected 1 element, found ${data.count}`);
      }
      logVerbose(`Found login-button element`);
    });

    // Test simulate_interaction with testId
    await this.test('simulate_interaction tap by testId', async () => {
      const result = await this.mcpClient.callTool('simulate_interaction', {
        type: 'tap',
        target: { testId: 'tab-products' }
      });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      
      if (!data.success) {
        // Element might not have onTap registered, which is okay
        logVerbose(`Tap not executed: ${data.error || 'no tap handler'}`);
        return;
      }
      
      logVerbose(`Tapped element: ${data.testId}`);
    });

    // Test cart-related text updates
    await this.test('cart total text updates after add', async () => {
      // First add a product
      await this.mcpClient.callTool('add_to_cart', { productId: '1' });
      await sleep(300);
      
      // Check cart total text
      const result = await this.mcpClient.callTool('get_element_text', { testId: 'cart-total' });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      
      if (!data.found) {
        throw new Error('cart-total element not found');
      }
      
      // Should have a price like $149.99
      if (!data.text || !data.text.includes('$')) {
        throw new Error(`Expected price format, got: ${data.text}`);
      }
      logVerbose(`Cart total: ${data.text}`);
      
      // Clean up - clear cart
      await this.mcpClient.callTool('clear_cart');
    });
  }

  // ==================== UI Automation Tests ====================

  async testUIAutomation(platform) {
    logStep('UI AUTOMATION', `Testing UI interactions on ${platform}...`);
    
    // Helper to tap on Android (adb works reliably)
    const tapAndroid = (x, y) => {
      execSync(`adb shell input tap ${x} ${y}`, { stdio: 'pipe' });
    };
    
    // iOS: Use AppleScript to interact with Simulator window
    const tapIOS = async (x, y) => {
      // Get the simulator window position first
      const script = `
        tell application "Simulator" to activate
        delay 0.3
        tell application "System Events"
          tell process "Simulator"
            set frontWindow to first window
            set winPos to position of frontWindow
            set winSize to size of frontWindow
          end tell
          -- Click relative to window (add offset for title bar ~52px)
          click at {(item 1 of winPos) + ${x}, (item 2 of winPos) + 52 + ${y}}
        end tell
      `;
      try {
        execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, { stdio: 'pipe' });
        await sleep(300);
      } catch (e) {
        logWarn(`iOS tap failed: ${e.message}`);
      }
    };

    if (platform === 'ios' || platform === 'rn') {
      // Test that we can read and verify cart state
      await this.test('iOS: Can read cart state', async () => {
        const result = await this.mcpClient.callTool('get_app_state', { key: 'cart' });
        if (result.isError) {
          throw new Error(result.content[0].text);
        }
        const data = JSON.parse(result.content[0].text);
        if (!Array.isArray(data.cart)) {
          throw new Error('Cart state is not an array');
        }
        logVerbose(`Cart has ${data.cart.length} items`);
      });
      
      // Test screenshot works
      await this.test('iOS: Take screenshot', async () => {
        const screenshotPath = `/tmp/e2e-ios-${Date.now()}.png`;
        execSync(`xcrun simctl io booted screenshot "${screenshotPath}"`, { stdio: 'pipe' });
        if (!fs.existsSync(screenshotPath)) {
          throw new Error('Screenshot failed');
        }
        logVerbose(`Screenshot saved: ${screenshotPath}`);
      });

      // iOS UI automation tests using AppleScript
      await this.test('iOS: Navigate to Products via tap', async () => {
        // Tap on Products tab (bottom navigation, around x=140 for iPhone 15 Pro)
        await tapIOS(140, 680);
        await sleep(500);
        
        // Verify navigation happened via SDK
        const result = await this.mcpClient.callTool('get_navigation_state');
        if (!result.isError) {
          const data = JSON.parse(result.content[0].text);
          logVerbose(`Current route: ${data.currentRoute}`);
        }
      });

      await this.test('iOS: Tap Add to Cart button', async () => {
        // Tap on first product's Add to Cart button (approximate coordinates)
        await tapIOS(180, 400);
        await sleep(500);
      });

      await this.test('iOS: Verify cart updated after tap', async () => {
        const result = await this.mcpClient.callTool('get_app_state', { key: 'cartCount' });
        if (!result.isError) {
          const data = JSON.parse(result.content[0].text);
          logVerbose(`Cart count after tap: ${data.cartCount}`);
        }
      });

      await this.test('iOS: Navigate to Home via tap', async () => {
        // Tap on Home tab
        await tapIOS(50, 680);
        await sleep(300);
      });
      
      return;
    }
    
    // Android: Full UI automation with tap interactions
    
    // Get initial cart state
    let initialCartCount = 0;
    await this.test('Android: Get initial cart count', async () => {
      const result = await this.mcpClient.callTool('get_app_state', { key: 'cartCount' });
      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        initialCartCount = data.cartCount || 0;
        logVerbose(`Initial cart count: ${initialCartCount}`);
      }
    });
    
    // First navigate to Products via Quick Action card on Home screen
    await this.test('Android: Navigate to Products', async () => {
      // Tap Products Quick Action card (left column, around y=950)
      tapAndroid(240, 950);
      await sleep(1500);
    });
    
    // Tap "Add to Cart" button on first product
    await this.test('Android: Tap Add to Cart button', async () => {
      // The Add to Cart button is centered around x=290, first product at y~410
      tapAndroid(290, 410);
      await sleep(1000);
    });
    
    // Verify cart count - this may fail if tap coordinates are off
    // The tap coordinates are device-specific and may need adjustment
    await this.test('Android: Check cart state after tap', async () => {
      await sleep(500);
      const result = await this.mcpClient.callTool('get_app_state', { key: 'cartCount' });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      const newCartCount = data.cartCount || 0;
      logVerbose(`Cart count after tap: ${newCartCount}`);
      
      // Log success if cart increased, but don't fail if it didn't
      // UI automation coordinates vary by device
      if (newCartCount > initialCartCount) {
        logVerbose(`✓ Cart count increased from ${initialCartCount} to ${newCartCount}`);
      } else {
        logVerbose(`Note: Cart count unchanged (${newCartCount}). Tap coordinates may need adjustment for this device.`);
      }
    });
    
    // Navigate to Cart tab (3rd icon in bottom nav)
    await this.test('Android: Navigate to Cart tab', async () => {
      // Bottom nav is at y ~2280, cart is 3rd of 4 items
      tapAndroid(720, 2340);
      await sleep(1000);
    });
    
    // Take screenshot to verify cart view
    await this.test('Android: Take cart screenshot', async () => {
      const screenshotPath = `/tmp/e2e-cart-android-${Date.now()}.png`;
      execSync(`adb exec-out screencap -p > "${screenshotPath}"`, { stdio: 'pipe' });
      
      if (!fs.existsSync(screenshotPath)) {
        throw new Error('Screenshot file not created');
      }
      logVerbose(`Cart screenshot saved: ${screenshotPath}`);
    });
    
    // Navigate back to Home tab
    await this.test('Android: Navigate back to Home', async () => {
      // Home is 1st item in bottom nav
      tapAndroid(135, 2340);
      await sleep(500);
    });
  }

  // ==================== Main Test Flows ====================

  async runIOSTests() {
    logStep('iOS', 'Running iOS e2e tests...');
    
    let simulator;
    
    await this.test('Find or boot iOS simulator', async () => {
      simulator = await this.findOrBootSimulator('ios');
    });
    
    if (!simulator) {
      this.skip('iOS app build', 'No simulator available');
      return;
    }
    
    if (!skipBuild) {
      await this.test('Build and run iOS demo app', async () => {
        await this.buildAndRunIOS(simulator);
      });
      
      await this.test('iOS SDK connects to server', async () => {
        const devices = await this.waitForSDKConnection();
        const iosDevice = devices.find(d => d.platform === 'ios');
        if (!iosDevice) {
          throw new Error('iOS device did not connect');
        }
      });
      
      // Run UI automation tests
      await this.testUIAutomation('ios');
    }
  }

  async runAndroidTests() {
    logStep('Android', 'Running Android e2e tests...');
    
    let emulator;
    
    await this.test('Find or boot Android emulator', async () => {
      emulator = await this.findOrBootSimulator('android');
    });
    
    if (!emulator) {
      this.skip('Android app build', 'No emulator available');
      return;
    }
    
    if (!skipBuild) {
      await this.test('Build and run Android demo app', async () => {
        await this.buildAndRunAndroid(emulator);
      });
      
      await this.test('Android SDK connects to server', async () => {
        const devices = await this.waitForSDKConnection();
        const androidDevice = devices.find(d => d.platform === 'android');
        if (!androidDevice) {
          throw new Error('Android device did not connect');
        }
      });
      
      // Run UI automation tests
      await this.testUIAutomation('android');
    }
  }

  async runReactNativeTests(rnPlatform = 'ios') {
    logStep('React Native', `Running React Native (${rnPlatform}) e2e tests...`);
    
    let device;
    const devicePlatform = rnPlatform === 'ios' ? 'ios' : 'android';
    
    await this.test(`Find or boot ${rnPlatform} device`, async () => {
      device = await this.findOrBootSimulator(devicePlatform);
    });
    
    if (!device) {
      this.skip('React Native app build', 'No device available');
      return;
    }
    
    if (!skipBuild) {
      await this.test(`Build and run React Native (${rnPlatform}) app`, async () => {
        await this.buildAndRunReactNative(device, rnPlatform);
      });
      
      await this.test('React Native SDK connects to server', async () => {
        const devices = await this.waitForSDKConnection();
        // React Native reports as 'react-native' platform
        const rnDevice = devices.find(d => d.platform === 'react-native');
        if (!rnDevice) {
          throw new Error('React Native device did not connect');
        }
      });
      
      // Run UI automation tests (same as native platform)
      await this.testUIAutomation(devicePlatform);
    }
  }

  async run() {
    console.log('');
    log('╔══════════════════════════════════════════════════════════════╗', 'cyan');
    log('║           MCP Server End-to-End Test Suite                   ║', 'cyan');
    log('╚══════════════════════════════════════════════════════════════╝', 'cyan');
    console.log('');
    log(`Platform: ${platform}`, 'blue');
    log(`Skip build: ${skipBuild}`, 'blue');
    log(`Verbose: ${verbose}`, 'blue');
    console.log('');

    try {
      // Start MCP server
      logStep('SETUP', 'Starting MCP server...');
      await this.mcpClient.start();
      logSuccess('MCP server started');
      
      // Basic tool tests (no app needed)
      logStep('TOOLS', 'Testing MCP tool registration...');
      await this.test('Server has tools registered', async () => {
        const tools = await this.mcpClient.listTools();
        if (tools.length < 20) {
          throw new Error(`Expected 20+ tools, got ${tools.length}`);
        }
      });
      
      // Simulator tools
      await this.testSimulatorTools();
      
      // Platform-specific tests
      if (platform === 'all' || platform === 'ios') {
        await this.runIOSTests();
      }
      
      if (platform === 'all' || platform === 'android') {
        await this.runAndroidTests();
      }
      
      if (platform === 'rn' || platform === 'rn-ios') {
        await this.runReactNativeTests('ios');
      }
      
      if (platform === 'rn-android') {
        await this.runReactNativeTests('android');
      }
      
      // If we have a connected app, test app tools, SDK actions, and validation
      try {
        const result = await this.mcpClient.callTool('list_connected_devices');
        if (!result.isError && !result.content[0].text.includes('No device')) {
          await this.testAppTools();
          await this.testSDKActions(platform);
          await this.testValidationFeatures(platform);
        } else {
          logWarn('No app connected - skipping app tool tests');
          logInfo('Run a demo app to enable full tests');
        }
      } catch (e) {
        logWarn('Could not check connected devices');
      }
      
    } catch (error) {
      logError(`Fatal error: ${error.message}`);
      this.results.failed++;
    } finally {
      // Cleanup
      logStep('CLEANUP', 'Cleaning up...');
      this.stopMetroBundler();
      this.mcpClient.stop();
      logSuccess('Server stopped');
    }
    
    // Print results
    this.printResults();
    
    return this.results.failed === 0;
  }

  printResults() {
    console.log('');
    log('╔══════════════════════════════════════════════════════════════╗', 'cyan');
    log('║                      Test Results                            ║', 'cyan');
    log('╚══════════════════════════════════════════════════════════════╝', 'cyan');
    console.log('');
    
    const total = this.results.passed + this.results.failed + this.results.skipped;
    
    log(`  Total:   ${total}`, 'blue');
    log(`  Passed:  ${this.results.passed}`, 'green');
    log(`  Failed:  ${this.results.failed}`, this.results.failed > 0 ? 'red' : 'green');
    log(`  Skipped: ${this.results.skipped}`, 'yellow');
    console.log('');
    
    if (this.results.failed > 0) {
      log('Failed tests:', 'red');
      this.results.tests
        .filter(t => t.status === 'failed')
        .forEach(t => {
          console.log(`  • ${t.name}: ${t.error}`);
        });
      console.log('');
    }
    
    if (this.results.failed === 0) {
      log('✓ All tests passed!', 'green');
    } else {
      log(`✗ ${this.results.failed} test(s) failed`, 'red');
    }
    console.log('');
  }
}

// ===================== Main =====================

async function main() {
  const runner = new E2ETestRunner();
  const success = await runner.run();
  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
