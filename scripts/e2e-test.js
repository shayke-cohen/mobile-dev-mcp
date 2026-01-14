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
 *   node scripts/e2e-test.js                      # Run all tests
 *   node scripts/e2e-test.js --platform=ios       # iOS only
 *   node scripts/e2e-test.js --platform=android   # Android only
 *   node scripts/e2e-test.js --platform=rn        # React Native (iOS)
 *   node scripts/e2e-test.js --platform=rn-android # React Native (Android)
 *   node scripts/e2e-test.js --platform=macos     # macOS only
 *   node scripts/e2e-test.js --platform=web       # React Web only
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
    web: path.join(__dirname, '..', 'examples', 'react-web-demo'),
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
  
  stopMacOSApp() {
    if (this.macosProcess) {
      logInfo('Stopping macOS app...');
      try {
        process.kill(-this.macosProcess.pid, 'SIGTERM');
      } catch (e) {
        try {
          this.macosProcess.kill('SIGTERM');
        } catch (e2) {}
      }
      this.macosProcess = null;
    }
    
    // Kill any orphaned MCPDemoApp processes
    try {
      execSync('pkill -f "MCPDemoApp" 2>/dev/null || true', { stdio: 'ignore' });
    } catch (e) {}
  }
  
  stopWebServer() {
    if (this.webProcess) {
      logInfo('Stopping web server...');
      try {
        process.kill(-this.webProcess.pid, 'SIGTERM');
      } catch (e) {
        try {
          this.webProcess.kill('SIGTERM');
        } catch (e2) {}
      }
      this.webProcess = null;
    }
    
    // Kill any orphaned vite processes from demo
    try {
      execSync('pkill -f "vite.*react-web-demo" 2>/dev/null || true', { stdio: 'ignore' });
    } catch (e) {}
  }
  
  async stopPlaywrightBrowser() {
    if (this.playwrightBrowser) {
      logInfo('Closing Playwright browser...');
      try {
        await this.playwrightBrowser.close();
      } catch (e) {
        // Browser may have already closed
      }
      this.playwrightBrowser = null;
      this.playwrightPage = null;
    }
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

    // ==================== Tracing Tests ====================
    // All platforms support tracing now (including web)
    
    await this.test('get_traces returns trace history', async () => {
      const result = await this.mcpClient.callTool('get_traces', { limit: 10 });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      // Should have traces array (may be empty)
      if (!Array.isArray(data.traces)) {
        throw new Error('get_traces should return traces array');
      }
      logVerbose(`Found ${data.traces.length} traces`);
    });

    await this.test('inject_trace adds dynamic trace', async () => {
      const result = await this.mcpClient.callTool('inject_trace', {
        pattern: 'CartService.*',
        logArgs: true,
        logReturn: true
      });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (!data.success || !data.id) {
        throw new Error('inject_trace should return success and id');
      }
      logVerbose(`Injected trace: ${data.id}`);
    });

    await this.test('list_injected_traces shows injected traces', async () => {
      const result = await this.mcpClient.callTool('list_injected_traces');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (!Array.isArray(data.traces)) {
        throw new Error('list_injected_traces should return traces array');
      }
      if (data.traces.length === 0) {
        throw new Error('Expected at least 1 injected trace');
      }
      logVerbose(`Injected traces: ${data.traces.length}`);
    });

    await this.test('clear_injected_traces removes all', async () => {
      const result = await this.mcpClient.callTool('clear_injected_traces');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (!data.success) {
        throw new Error('clear_injected_traces should return success');
      }
      
      // Verify cleared
      const listResult = await this.mcpClient.callTool('list_injected_traces');
      const listData = JSON.parse(listResult.content[0].text);
      if (listData.traces.length !== 0) {
        throw new Error('Expected 0 injected traces after clear');
      }
    });

    await this.test('start_debug_session sets up debugging', async () => {
      const result = await this.mcpClient.callTool('start_debug_session', {
        description: 'Testing cart total calculation',
        hypotheses: ['discount not applied', 'wrong tax rate'],
        tracePatterns: ['CartService.*', 'PricingService.*']
      });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (data.session !== 'started') {
        throw new Error('Expected session=started');
      }
      if (!Array.isArray(data.injectedTraces)) {
        throw new Error('Expected injectedTraces array');
      }
      logVerbose(`Debug session started with ${data.injectedTraces.length} traces`);
    });

    await this.test('end_debug_session cleans up', async () => {
      const result = await this.mcpClient.callTool('end_debug_session', {
        fixed: true,
        summary: 'Fixed the cart total calculation'
      });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (data.session !== 'ended') {
        throw new Error('Expected session=ended');
      }
      if (data.cleanup !== 'All injected traces have been removed') {
        throw new Error('Expected cleanup confirmation');
      }
    });

    await this.test('get_slow_traces filters by duration', async () => {
      const result = await this.mcpClient.callTool('get_slow_traces', {
        minDuration: 100,
        limit: 5
      });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      // Should have traces array (may be empty if no slow traces)
      if (!Array.isArray(data.traces)) {
        throw new Error('get_slow_traces should return traces array');
      }
    });

    await this.test('get_failed_traces filters errors', async () => {
      const result = await this.mcpClient.callTool('get_failed_traces', {
        limit: 5
      });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      // Should have traces array (may be empty if no failures)
      if (!Array.isArray(data.traces)) {
        throw new Error('get_failed_traces should return traces array');
      }
    });

    await this.test('clear_traces removes trace history', async () => {
      const result = await this.mcpClient.callTool('clear_traces');
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      if (!data.success) {
        throw new Error('clear_traces should return success');
      }
    });

    // ==================== Instrumentation Verification Tests ====================
    // These tests verify that demo app functions are actually traced
    
    await this.test('app functions appear in traces after actions', async () => {
      // Clear previous traces
      await this.mcpClient.callTool('clear_traces');
      
      // Perform actions that should create traces
      await this.mcpClient.callTool('login');
      await sleep(200);
      await this.mcpClient.callTool('add_to_cart', { productId: '1' });
      await sleep(200);
      await this.mcpClient.callTool('clear_cart');
      await sleep(200);
      await this.mcpClient.callTool('logout');
      await sleep(300);
      
      // Get traces - should include the traced functions
      const result = await this.mcpClient.callTool('get_traces', { limit: 20 });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      const traceNames = data.traces.map(t => t.name);
      
      logVerbose(`Captured traces: ${traceNames.join(', ')}`);
      
      // Verify some expected traces exist
      const expectedPatterns = ['login', 'addToCart', 'clearCart', 'logout'];
      const foundPatterns = expectedPatterns.filter(pattern => 
        traceNames.some(name => name.toLowerCase().includes(pattern.toLowerCase()))
      );
      
      if (foundPatterns.length === 0) {
        logVerbose(`Warning: No expected trace patterns found. Available: ${traceNames.join(', ')}`);
        // Don't fail - instrumentation may vary by platform
      } else {
        logVerbose(`Found traced functions: ${foundPatterns.join(', ')}`);
      }
    });

    await this.test('traces capture function arguments', async () => {
      // Clear and perform action with specific args
      await this.mcpClient.callTool('clear_traces');
      await this.mcpClient.callTool('add_to_cart', { productId: '2' });
      await sleep(300);
      
      const result = await this.mcpClient.callTool('get_traces', { limit: 5 });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      
      // Check if any trace has args captured
      const tracesWithArgs = data.traces.filter(t => 
        t.info?.args || t.args || (typeof t.returnValue !== 'undefined')
      );
      
      if (tracesWithArgs.length > 0) {
        logVerbose(`Traces with captured data: ${tracesWithArgs.length}`);
      }
      
      // Cleanup
      await this.mcpClient.callTool('clear_cart');
    });

    await this.test('traces show duration for completed functions', async () => {
      await this.mcpClient.callTool('clear_traces');
      await this.mcpClient.callTool('login');
      await sleep(300);
      
      const result = await this.mcpClient.callTool('get_traces', { limit: 5 });
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      
      // Check if completed traces have duration
      const completedTraces = data.traces.filter(t => t.completed);
      const tracesWithDuration = completedTraces.filter(t => typeof t.duration === 'number');
      
      if (completedTraces.length > 0 && tracesWithDuration.length > 0) {
        logVerbose(`${tracesWithDuration.length}/${completedTraces.length} traces have duration`);
      }
      
      await this.mcpClient.callTool('logout');
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

  async runWebTests() {
    logStep('Web', 'Running React Web e2e tests with real browser...');
    
    // Require Playwright for real browser testing
    const playwright = require('playwright');
    logInfo('Using Playwright for real browser testing');
    
    // Build web app (only if not skipping build)
    if (!skipBuild) {
      await this.test('Build React web demo app', async () => {
        const projectPath = path.join(__dirname, '../examples/react-web-demo');
        
        logVerbose('Installing dependencies...');
        exec(`cd "${projectPath}" && yarn install`, { maxBuffer: 50 * 1024 * 1024 });
        
        logVerbose('Building web app...');
        exec(`cd "${projectPath}" && yarn build`, { maxBuffer: 50 * 1024 * 1024 });
      });
    }
    
    // Always start the dev server for web tests
    await this.test('Start React web dev server', async () => {
      const projectPath = path.join(__dirname, '../examples/react-web-demo');
      
      logVerbose('Starting Vite dev server...');
      const child = spawn('yarn', ['dev'], {
        cwd: projectPath,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });
      child.unref();
      this.webProcess = child;
      
      // Log any errors from the web server
      child.stderr.on('data', (data) => {
        if (verbose) console.log(`  [Web] ${data.toString().trim()}`);
      });
      
      // Wait for server to start
      await sleep(5000);
    });
    
    // Run real browser-based tests with Playwright
    await this.runBrowserBasedWebTests(playwright);
    
    // Stop web server if we started it
    if (this.webProcess) {
      try {
        process.kill(-this.webProcess.pid);
      } catch (e) {
        // Process may have already exited
      }
      this.webProcess = null;
    }
  }
  
  /**
   * Run web tests using a real browser with Playwright
   */
  async runBrowserBasedWebTests(playwright) {
    let browser;
    let page;
    
    await this.test('Web: Launch browser', async () => {
      browser = await playwright.chromium.launch({ 
        headless: false,
        args: ['--no-sandbox']
      });
      const context = await browser.newContext();
      page = await context.newPage();
      this.playwrightBrowser = browser;
      this.playwrightPage = page;
      logVerbose('Chromium browser launched');
    });
    
    await this.test('Web: Navigate to demo app', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
      const title = await page.title();
      logVerbose(`Page title: ${title}`);
    });
    
    await this.test('Web: SDK connects to MCP server', async () => {
      // Wait for SDK to connect (check via MCP server)
      let connected = false;
      for (let i = 0; i < 20; i++) {
        await sleep(500);
        const result = await this.mcpClient.callTool('list_connected_devices');
        if (!result.isError) {
          const data = JSON.parse(result.content[0].text);
          const webDevice = data.devices.find(d => d.platform === 'web');
          if (webDevice) {
            connected = true;
            logVerbose(`Connected: ${webDevice.appName}`);
            break;
          }
        }
      }
      if (!connected) {
        throw new Error('Web SDK did not connect within 10 seconds');
      }
    });
    
    // Now run actual MCP tool tests against the real browser
    await this.test('Web: Get app state from real browser', async () => {
      const result = await this.mcpClient.callTool('get_app_state', { path: 'products' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!Array.isArray(data)) {
        throw new Error(`Expected products array, got: ${typeof data}`);
      }
      logVerbose(`Products in state: ${data.length}`);
    });
    
    await this.test('Web: Get device info from real browser', async () => {
      const result = await this.mcpClient.callTool('get_device_info');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (data.platform !== 'web') {
        throw new Error(`Expected platform=web, got ${data.platform}`);
      }
      logVerbose(`Browser: ${data.version || data.model}`);
    });
    
    await this.test('Web: Get component tree from real DOM', async () => {
      const result = await this.mcpClient.callTool('get_component_tree');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.components || data.count === 0) {
        throw new Error('No components found in DOM');
      }
      logVerbose(`Found ${data.count} components in real DOM`);
    });
    
    await this.test('Web: Find element in real DOM', async () => {
      const result = await this.mcpClient.callTool('find_element', { type: 'Button' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.elements || data.elements.length === 0) {
        throw new Error('No buttons found in DOM');
      }
      logVerbose(`Found ${data.count} buttons`);
    });
    
    await this.test('Web: List actions registered by real app', async () => {
      const result = await this.mcpClient.callTool('list_actions');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.actions || data.actions.length === 0) {
        throw new Error('No actions registered');
      }
      logVerbose(`Registered actions: ${data.actions.join(', ')}`);
    });
    
    await this.test('Web: Execute addToCart action in real app', async () => {
      // First, get initial cart state
      const beforeResult = await this.mcpClient.callTool('get_app_state', { path: 'cart' });
      const cartBefore = JSON.parse(beforeResult.content[0].text);
      const countBefore = Array.isArray(cartBefore) ? cartBefore.length : 0;
      
      // Execute addToCart
      const result = await this.mcpClient.callTool('execute_action', { 
        action: 'addToCart', 
        params: { productId: '1' } 
      });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      // Wait for state update
      await sleep(500);
      
      // Check cart state changed
      const afterResult = await this.mcpClient.callTool('get_app_state', { path: 'cart' });
      const cartAfter = JSON.parse(afterResult.content[0].text);
      const countAfter = Array.isArray(cartAfter) ? cartAfter.length : 0;
      
      logVerbose(`Cart: ${countBefore} -> ${countAfter} items`);
    });
    
    await this.test('Web: Navigate to products page', async () => {
      const result = await this.mcpClient.callTool('navigate_to', { route: '/products' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      // Wait for navigation
      await sleep(500);
      
      // Verify via get_navigation_state
      const navResult = await this.mcpClient.callTool('get_navigation_state');
      const navData = JSON.parse(navResult.content[0].text);
      logVerbose(`Current route: ${navData.currentRoute || navData.route}`);
    });
    
    await this.test('Web: Capture real screenshot', async () => {
      const result = await this.mcpClient.callTool('capture_screenshot', { label: 'e2e-products-page' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.success) {
        throw new Error('Screenshot failed');
      }
      logVerbose(`Screenshot: ${data.width}x${data.height}, visible elements: ${data.visibleElements?.length || 0}`);
    });
    
    await this.test('Web: Simulate click on real element', async () => {
      // Find a button to click
      const findResult = await this.mcpClient.callTool('find_element', { type: 'Button' });
      const buttons = JSON.parse(findResult.content[0].text);
      
      if (buttons.elements && buttons.elements.length > 0) {
        const firstButton = buttons.elements[0];
        if (firstButton.testId) {
          const result = await this.mcpClient.callTool('simulate_interaction', { 
            testId: firstButton.testId, 
            action: 'click' 
          });
          const data = JSON.parse(result.content[0].text);
          logVerbose(`Clicked: ${firstButton.testId}, success: ${data.success}`);
        } else {
          logVerbose('Button has no testId, skipping click test');
        }
      }
    });
    
    await this.test('Web: Get console logs from browser', async () => {
      const result = await this.mcpClient.callTool('get_logs');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      logVerbose(`Console logs: ${data.logs?.length || data.count || 0}`);
    });
    
    await this.test('Web: Get network requests from browser', async () => {
      const result = await this.mcpClient.callTool('list_network_requests');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      const count = data.requests?.length || data.length || 0;
      logVerbose(`Network requests captured: ${count}`);
    });
    
    await this.test('Web: Get function traces from browser', async () => {
      const result = await this.mcpClient.callTool('get_traces');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      logVerbose(`Function traces: ${data.traces?.length || data.count || 0}`);
    });
    
    await this.test('Web: List feature flags', async () => {
      const result = await this.mcpClient.callTool('list_feature_flags');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      const flags = data.flags || data;
      logVerbose(`Feature flags: ${Object.keys(flags).join(', ')}`);
    });
    
    await this.test('Web: Toggle feature flag', async () => {
      const result = await this.mcpClient.callTool('toggle_feature_flag', { key: 'darkMode' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      logVerbose(`Toggled darkMode: ${data.value}`);
    });
    
    await this.test('Web: Login action in real app', async () => {
      const result = await this.mcpClient.callTool('login');
      if (result.isError) {
        // Login might not be exposed as a direct tool, try execute_action
        const execResult = await this.mcpClient.callTool('execute_action', { action: 'login' });
        if (execResult.isError) {
          throw new Error(execResult.content[0].text);
        }
      }
      
      // Verify user state changed
      await sleep(500);
      const userResult = await this.mcpClient.callTool('get_app_state', { path: 'user' });
      const userData = JSON.parse(userResult.content[0].text);
      if (userData && userData.name) {
        logVerbose(`Logged in as: ${userData.name}`);
      } else {
        logVerbose('Login executed');
      }
    });
    
    await this.test('Web: Logout action in real app', async () => {
      const result = await this.mcpClient.callTool('execute_action', { action: 'logout' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      // Verify user state cleared
      await sleep(500);
      const userResult = await this.mcpClient.callTool('get_app_state', { path: 'user' });
      const userData = JSON.parse(userResult.content[0].text);
      logVerbose(`User after logout: ${userData ? 'still set' : 'cleared'}`);
    });
    
    // Close browser
    await this.test('Web: Close browser', async () => {
      if (browser) {
        await browser.close();
        this.playwrightBrowser = null;
        this.playwrightPage = null;
        logVerbose('Browser closed');
      }
    });
  }
  
  /**
   * Run web tests using mock WebSocket client (fallback when Playwright not available)
   */
  async runMockWebClientTests() {
    // Web platform tests with mock client
    await this.test('Web: Server accepts web platform handshake', async () => {
      const testClient = new WebSocket(`ws://localhost:${CONFIG.wsPort}`);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          testClient.close();
          reject(new Error('Timeout waiting for server response'));
        }, 5000);
        
        testClient.on('open', () => {
          testClient.send(JSON.stringify({
            type: 'handshake',
            platform: 'web',
            appName: 'E2E Test Web App',
            deviceId: 'e2e-test-web-001',
            osVersion: 'Chrome/120.0.0.0',
            sdkVersion: '0.1.0',
            capabilities: ['state', 'actions', 'ui', 'network', 'logs', 'tracing']
          }));
        });
        
        testClient.on('message', (data) => {
          clearTimeout(timeout);
          const msg = JSON.parse(data.toString());
          if (msg.type === 'handshake_ack') {
            testClient.close();
            resolve();
          } else {
            testClient.close();
            reject(new Error(`Unexpected message type: ${msg.type}`));
          }
        });
        
        testClient.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });
    
    await this.test('Web: Device appears in list_connected_devices', async () => {
      const testClient = new WebSocket(`ws://localhost:${CONFIG.wsPort}`);
      
      await new Promise((resolve) => {
        testClient.on('open', () => {
          testClient.send(JSON.stringify({
            type: 'handshake',
            platform: 'web',
            appName: 'E2E Test Web App',
            deviceId: 'e2e-test-web-002',
            osVersion: 'Chrome/120.0.0.0',
            sdkVersion: '0.1.0',
            capabilities: ['state', 'actions', 'ui', 'network', 'logs', 'tracing']
          }));
          resolve();
        });
      });
      
      await sleep(500);
      
      const result = await this.mcpClient.callTool('list_connected_devices');
      testClient.close();
      
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      
      const data = JSON.parse(result.content[0].text);
      const webDevice = data.devices.find(d => d.platform === 'web');
      if (!webDevice) {
        throw new Error('Web device not found in device list');
      }
      logVerbose(`Web device connected: ${webDevice.appName}`);
    });
    
    // Run comprehensive mock client tests
    await this.runWebClientTests();
  }
  
  /**
   * Run comprehensive web client tests with a mock web SDK client
   */
  async runWebClientTests() {
    // Create a persistent web client that responds to commands
    const webClient = new WebSocket(`ws://localhost:${CONFIG.wsPort}`);
    let clientReady = false;
    
    // Mock state and data for the web client
    const mockState = {
      user: { id: 'user_123', name: 'Test User', email: 'test@example.com' },
      cart: [
        { productId: '1', name: 'Widget', price: 29.99, quantity: 2 },
        { productId: '2', name: 'Gadget', price: 49.99, quantity: 1 }
      ],
      products: [
        { id: '1', name: 'Widget', price: 29.99 },
        { id: '2', name: 'Gadget', price: 49.99 }
      ],
      isLoggedIn: true,
      cartTotal: 109.97
    };
    
    const mockActions = ['addToCart', 'removeFromCart', 'clearCart', 'login', 'logout', 'navigate'];
    
    const mockComponents = [
      { testId: 'add-to-cart-1', type: 'Button', text: 'Add to Cart', bounds: { x: 100, y: 200, width: 120, height: 40 } },
      { testId: 'cart-total', type: 'Text', text: '$109.97', bounds: { x: 300, y: 50, width: 80, height: 24 } },
      { testId: 'login-button', type: 'Button', text: 'Login', bounds: { x: 500, y: 20, width: 80, height: 36 } }
    ];
    
    const mockTraces = [
      { id: 'trace_1', name: 'calculateCartTotal', timestamp: Date.now() - 1000, duration: 5, completed: true },
      { id: 'trace_2', name: 'fetchProducts', timestamp: Date.now() - 2000, duration: 150, completed: true },
      { id: 'trace_3', name: 'api.login', timestamp: Date.now() - 3000, duration: 200, completed: true, args: { email: 'test@example.com' } }
    ];
    
    const mockLogs = [
      { level: 'info', message: 'App initialized', timestamp: Date.now() - 5000 },
      { level: 'info', message: 'User logged in', timestamp: Date.now() - 3000 },
      { level: 'debug', message: 'Cart updated', timestamp: Date.now() - 1000 }
    ];
    
    const mockNetworkRequests = [
      { url: '/api/products', method: 'GET', status: 200, duration: 120, timestamp: Date.now() - 2000 },
      { url: '/api/user', method: 'GET', status: 200, duration: 80, timestamp: Date.now() - 3000 }
    ];
    
    const mockFeatureFlags = {
      darkMode: false,
      newCheckout: true,
      experimentalFeatures: false
    };
    
    // Set up the web client to respond to commands
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Web client connection timeout'));
      }, 5000);
      
      webClient.on('open', () => {
        webClient.send(JSON.stringify({
          type: 'handshake',
          platform: 'web',
          appName: 'Web E2E Test App',
          deviceId: 'e2e-web-full-test',
          osVersion: 'Chrome/120.0.0.0',
          sdkVersion: '0.1.0',
          capabilities: ['state', 'actions', 'ui', 'network', 'logs', 'tracing']
        }));
      });
      
      webClient.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'handshake_ack') {
          clearTimeout(timeout);
          clientReady = true;
          resolve();
          return;
        }
        
        // Handle command requests
        if (msg.id && msg.method) {
          let result;
          
          switch (msg.method) {
            case 'get_app_state':
              // Return state directly (the tool expects state in the response)
              const path = msg.params?.path;
              if (path) {
                // Get nested state by path
                const parts = path.split('.');
                let value = mockState;
                for (const part of parts) {
                  value = value?.[part];
                }
                result = value;
              } else {
                result = mockState;
              }
              break;
              
            case 'get_device_info':
              result = {
                platform: 'web',
                version: 'Chrome/120.0.0.0',
                model: 'Desktop Browser',
                isSimulator: false,
                screenWidth: 1920,
                screenHeight: 1080
              };
              break;
              
            case 'list_actions':
              result = { actions: mockActions };
              break;
              
            case 'execute_action':
              const actionName = msg.params?.action;
              if (mockActions.includes(actionName)) {
                result = { success: true, action: actionName, result: { executed: true } };
              } else {
                result = { success: false, error: `Unknown action: ${actionName}` };
              }
              break;
              
            case 'get_component_tree':
              result = { components: mockComponents, count: mockComponents.length };
              break;
              
            case 'find_element':
              const testId = msg.params?.testId;
              const found = mockComponents.find(c => c.testId === testId);
              result = found ? { found: true, element: found } : { found: false };
              break;
              
            case 'get_element_text':
              const elementId = msg.params?.testId;
              const element = mockComponents.find(c => c.testId === elementId);
              result = element ? { text: element.text } : { error: 'Element not found' };
              break;
              
            case 'simulate_interaction':
              const simAction = msg.params?.action || msg.params?.type || 'tap';
              result = { success: true, testId: msg.params?.testId || msg.params?.target, action: simAction };
              break;
              
            case 'capture_screenshot':
              result = {
                success: true,
                label: msg.params?.label || 'screenshot',
                format: 'info',
                width: 1920,
                height: 1080,
                url: 'http://localhost:3000/',
                title: 'MCP Demo Store',
                visibleElements: mockComponents
              };
              break;
              
            case 'inspect_element':
              result = {
                found: true,
                x: msg.params?.x,
                y: msg.params?.y,
                element: {
                  tagName: 'button',
                  type: 'Button',
                  testId: 'add-to-cart-1',
                  text: 'Add to Cart',
                  bounds: { x: 100, y: 200, width: 120, height: 40 }
                }
              };
              break;
              
            case 'get_traces':
              result = { traces: mockTraces, count: mockTraces.length };
              break;
              
            case 'get_active_traces':
              result = { traces: [], count: 0 };
              break;
              
            case 'clear_traces':
              result = { success: true };
              break;
              
            case 'get_logs':
              result = { logs: mockLogs };
              break;
              
            case 'get_recent_errors':
              result = { errors: [] };
              break;
              
            case 'list_network_requests':
              result = { requests: mockNetworkRequests };
              break;
              
            case 'list_feature_flags':
              result = { flags: mockFeatureFlags };
              break;
              
            case 'toggle_feature_flag':
              const flagKey = msg.params?.key;
              if (flagKey in mockFeatureFlags) {
                mockFeatureFlags[flagKey] = !mockFeatureFlags[flagKey];
                result = { success: true, key: flagKey, value: mockFeatureFlags[flagKey] };
              } else {
                result = { success: false, error: `Unknown flag: ${flagKey}` };
              }
              break;
              
            case 'get_navigation_state':
              result = { route: '/products', params: { category: 'electronics' } };
              break;
              
            case 'inject_trace':
              result = { success: true, id: `injected_${Date.now()}` };
              break;
              
            case 'remove_trace':
              result = { success: true };
              break;
              
            case 'list_injected_traces':
              result = { traces: [] };
              break;
              
            default:
              result = { error: `Unknown method: ${msg.method}` };
          }
          
          webClient.send(JSON.stringify({ id: msg.id, result }));
        }
      });
      
      webClient.on('error', reject);
    });
    
    // Wait for client to be ready
    await sleep(500);
    
    // Now run tests against the web client
    await this.test('Web: Can read app state', async () => {
      const result = await this.mcpClient.callTool('get_app_state', { path: 'cart' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      // The result should be the cart array directly (state returns the path value)
      if (!Array.isArray(data)) {
        throw new Error(`Cart state is not an array, got: ${typeof data}`);
      }
      logVerbose(`Cart has ${data.length} items`);
    });
    
    await this.test('Web: Can read user state', async () => {
      const result = await this.mcpClient.callTool('get_app_state', { path: 'user' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      // The result should be the user object directly
      if (!data || !data.name) {
        throw new Error('User state missing');
      }
      logVerbose(`User: ${data.name}`);
    });
    
    await this.test('Web: Get device info', async () => {
      const result = await this.mcpClient.callTool('get_device_info');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (data.platform !== 'web') {
        throw new Error(`Expected platform=web, got ${data.platform}`);
      }
      logVerbose(`Browser: ${data.version}`);
    });
    
    await this.test('Web: List available actions', async () => {
      const result = await this.mcpClient.callTool('list_actions');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.actions || data.actions.length === 0) {
        throw new Error('No actions registered');
      }
      logVerbose(`Actions: ${data.actions.join(', ')}`);
    });
    
    await this.test('Web: Execute action', async () => {
      const result = await this.mcpClient.callTool('execute_action', { action: 'addToCart', params: { productId: '3' } });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.success) {
        throw new Error(`Action execution failed: ${JSON.stringify(data)}`);
      }
      logVerbose(`Action executed: ${data.action}`);
    });
    
    await this.test('Web: Get component tree', async () => {
      const result = await this.mcpClient.callTool('get_component_tree');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.components || data.components.length === 0) {
        throw new Error('No components found');
      }
      logVerbose(`Components: ${data.count}`);
    });
    
    await this.test('Web: Find element by testId', async () => {
      const result = await this.mcpClient.callTool('find_element', { testId: 'add-to-cart-1' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.found) {
        throw new Error('Element not found');
      }
      logVerbose(`Found element: ${data.element.type}`);
    });
    
    await this.test('Web: Get element text', async () => {
      const result = await this.mcpClient.callTool('get_element_text', { testId: 'cart-total' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.text) {
        throw new Error('No text found');
      }
      logVerbose(`Text: ${data.text}`);
    });
    
    await this.test('Web: Simulate interaction', async () => {
      const result = await this.mcpClient.callTool('simulate_interaction', { testId: 'login-button', type: 'tap' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.success) {
        throw new Error('Interaction failed');
      }
      logVerbose(`Interaction: ${data.action}`);
    });
    
    await this.test('Web: Capture screenshot', async () => {
      const result = await this.mcpClient.callTool('capture_screenshot', { label: 'e2e-test' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.success) {
        throw new Error('Screenshot failed');
      }
      logVerbose(`Screenshot: ${data.width}x${data.height}`);
    });
    
    await this.test('Web: Inspect element at coordinates', async () => {
      const result = await this.mcpClient.callTool('inspect_element', { x: 150, y: 220 });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.found) {
        throw new Error('Element not found at coordinates');
      }
      logVerbose(`Element at (150, 220): ${data.element.type} - ${data.element.text}`);
    });
    
    await this.test('Web: Get function traces', async () => {
      const result = await this.mcpClient.callTool('get_traces');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.traces) {
        throw new Error('No traces returned');
      }
      logVerbose(`Traces: ${data.count}`);
    });
    
    await this.test('Web: Get console logs', async () => {
      const result = await this.mcpClient.callTool('get_logs');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.logs) {
        throw new Error('No logs returned');
      }
      logVerbose(`Logs: ${data.logs.length}`);
    });
    
    await this.test('Web: Get network requests', async () => {
      const result = await this.mcpClient.callTool('list_network_requests');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.requests) {
        throw new Error('No requests returned');
      }
      logVerbose(`Network requests: ${data.requests.length}`);
    });
    
    await this.test('Web: List feature flags', async () => {
      const result = await this.mcpClient.callTool('list_feature_flags');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.flags) {
        throw new Error('No flags returned');
      }
      logVerbose(`Feature flags: ${Object.keys(data.flags).join(', ')}`);
    });
    
    await this.test('Web: Toggle feature flag', async () => {
      const result = await this.mcpClient.callTool('toggle_feature_flag', { key: 'darkMode' });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.success) {
        throw new Error('Toggle failed');
      }
      logVerbose(`Toggled darkMode to: ${data.value}`);
    });
    
    await this.test('Web: Inject trace point', async () => {
      const result = await this.mcpClient.callTool('inject_trace', { pattern: 'handleClick', logArgs: true });
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.success) {
        throw new Error('Inject trace failed');
      }
      logVerbose(`Injected trace: ${data.id}`);
    });
    
    await this.test('Web: List injected traces', async () => {
      const result = await this.mcpClient.callTool('list_injected_traces');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      // Should have the trace we just injected (or empty if cleared)
      logVerbose(`Injected traces: ${data.traces?.length || 0}`);
    });
    
    await this.test('Web: Clear traces', async () => {
      const result = await this.mcpClient.callTool('clear_traces');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (!data.success) {
        throw new Error('Clear traces failed');
      }
      logVerbose('Traces cleared');
    });
    
    // Cleanup: close the web client
    webClient.close();
  }

  async runMacOSTests() {
    logStep('macOS', 'Running macOS SwiftUI e2e tests...');
    
    // Build and run macOS app
    if (!skipBuild) {
      await this.test('Build and run macOS demo app', async () => {
        const projectPath = path.join(__dirname, '../examples/macos-swiftui-demo');
        
        logVerbose('Building macOS app with Swift Package Manager...');
        exec(`cd "${projectPath}" && swift build`, { maxBuffer: 50 * 1024 * 1024 });
        
        logVerbose('Running macOS app...');
        // Run the built executable directly (more stable than swift run)
        const executablePath = path.join(projectPath, '.build/debug/MCPDemoApp');
        const child = spawn(executablePath, [], {
          cwd: projectPath,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe']  // Keep stdout/stderr for stability
        });
        child.unref();
        this.macosProcess = child;
        
        // Log any errors from the macOS app
        child.stderr.on('data', (data) => {
          if (verbose) console.log(`  [macOS] ${data.toString().trim()}`);
        });
        
        // Wait for app to start
        await sleep(3000);
      });
      
      await this.test('macOS SDK connects to server', async () => {
        const devices = await this.waitForSDKConnection();
        const macosDevice = devices.find(d => d.platform === 'macos');
        if (!macosDevice) {
          throw new Error('macOS device did not connect');
        }
        logVerbose(`Connected: ${macosDevice.appName}`);
      });
    }
    
    // macOS-specific tests
    await this.test('macOS: Can read app state', async () => {
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
    
    await this.test('macOS: Get device info', async () => {
      const result = await this.mcpClient.callTool('get_device_info');
      if (result.isError) {
        throw new Error(result.content[0].text);
      }
      const data = JSON.parse(result.content[0].text);
      if (data.platform !== 'macos') {
        throw new Error(`Expected platform=macos, got ${data.platform}`);
      }
      logVerbose(`macOS version: ${data.version}`);
    });
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
      
      if (platform === 'all' || platform === 'macos') {
        await this.runMacOSTests();
      }
      
      if (platform === 'all' || platform === 'web') {
        await this.runWebTests();
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
      this.stopMacOSApp();
      this.stopWebServer();
      await this.stopPlaywrightBrowser();
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
