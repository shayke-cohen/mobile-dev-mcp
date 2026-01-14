#!/usr/bin/env node

/**
 * E2E Test Suite for Fastlane Tools
 * 
 * Tests fastlane integration tools via the MCP server.
 * These are "local tools" that don't require a connected device.
 * 
 * Usage:
 *   node scripts/e2e-test-fastlane.js
 *   node scripts/e2e-test-fastlane.js --use-existing-server
 *   node scripts/e2e-test-fastlane.js --verbose
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_PATH = path.join(__dirname, '..', 'packages', 'mcp-server', 'dist', 'index.js');
const USE_EXISTING_SERVER = process.argv.includes('--use-existing-server');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');
const TIMEOUT_TOOL_CALL = 30000;
const TIMEOUT_SERVER_START = 3000;

// Test state
let serverProcess = null;
let requestId = 0;
let pendingRequests = new Map();
let buffer = '';
let tempDirs = [];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logSection(title) {
  console.log();
  log(`${'═'.repeat(60)}`, colors.cyan);
  log(`  ${title}`, colors.cyan + colors.bright);
  log(`${'═'.repeat(60)}`, colors.cyan);
}

function logVerbose(message) {
  if (VERBOSE) {
    log(`   ${message}`, colors.yellow);
  }
}

// MARK: - Server Management (stdio-based MCP)

function processBuffer() {
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const response = JSON.parse(line);
      if (response.id && pendingRequests.has(response.id)) {
        const { resolve } = pendingRequests.get(response.id);
        pendingRequests.delete(response.id);
        resolve(response);
      }
    } catch (e) {
      logVerbose(`Non-JSON line: ${line.substring(0, 100)}`);
    }
  }
}

async function startServer() {
  if (USE_EXISTING_SERVER) {
    logInfo('Using existing server - spawning temp client for each call');
    return;
  }

  logInfo('Starting MCP server...');
  
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', [SERVER_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, MCP_LOG_LEVEL: VERBOSE ? 'debug' : 'info' },
    });

    serverProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      processBuffer();
    });

    serverProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (VERBOSE && msg) {
        console.log(`  [server] ${msg}`);
      }
    });

    serverProcess.on('error', (err) => {
      logError(`Server error: ${err.message}`);
      reject(err);
    });

    // Give server time to start
    setTimeout(() => {
      logSuccess('MCP server started');
      resolve();
    }, TIMEOUT_SERVER_START);
  });
}

function stopServer() {
  if (serverProcess) {
    logInfo('Stopping MCP server...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// MARK: - MCP Client (stdio-based)

async function call(method, params = {}) {
  if (USE_EXISTING_SERVER) {
    return callViaTempClient(method, params);
  }
  
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };
    
    logVerbose(`Request: ${JSON.stringify(request).substring(0, 150)}...`);
    
    pendingRequests.set(id, { resolve, reject });
    serverProcess.stdin.write(JSON.stringify(request) + '\n');
    
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, TIMEOUT_TOOL_CALL);
  });
}

async function callViaTempClient(method, params = {}) {
  // Spawn a temporary server process for this single call
  return new Promise((resolve, reject) => {
    const tempServer = spawn('node', [SERVER_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let tempBuffer = '';
    let responded = false;
    
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    };
    
    tempServer.stdout.on('data', (data) => {
      tempBuffer += data.toString();
      const lines = tempBuffer.split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line);
          if (response.id === 1 && !responded) {
            responded = true;
            tempServer.kill('SIGTERM');
            resolve(response);
          }
        } catch (e) {
          // Not JSON
        }
      }
    });
    
    tempServer.stderr.on('data', (data) => {
      if (VERBOSE) {
        console.log(`  [temp-server] ${data.toString().trim()}`);
      }
    });
    
    tempServer.on('error', (err) => {
      reject(err);
    });
    
    // Wait a moment for server to initialize, then send request
    setTimeout(() => {
      tempServer.stdin.write(JSON.stringify(request) + '\n');
    }, 1000);
    
    // Timeout
    setTimeout(() => {
      if (!responded) {
        tempServer.kill('SIGTERM');
        reject(new Error('Request timeout'));
      }
    }, TIMEOUT_TOOL_CALL);
  });
}

async function callTool(name, args = {}) {
  const response = await call('tools/call', { name, arguments: args });
  
  logVerbose(`Response: ${JSON.stringify(response).substring(0, 200)}...`);
  
  if (response.error) {
    throw new Error(response.error.message || JSON.stringify(response.error));
  }
  
  // Parse the content
  const content = response.result?.content?.[0];
  if (content?.type === 'text') {
    try {
      return JSON.parse(content.text);
    } catch {
      return content.text;
    }
  }
  
  return response.result;
}

// MARK: - Test Utilities

function createTempDir(name) {
  const dir = `/tmp/fastlane-e2e-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function createMockProject(dir, type = 'cross-platform') {
  if (type === 'ios' || type === 'cross-platform') {
    fs.mkdirSync(path.join(dir, 'ios', 'App.xcodeproj'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'ios', 'App.xcodeproj', 'project.pbxproj'), '// mock');
  }
  
  if (type === 'android' || type === 'cross-platform') {
    fs.mkdirSync(path.join(dir, 'android', 'app'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'android', 'build.gradle'), 'android {}');
    fs.writeFileSync(path.join(dir, 'android', 'app', 'build.gradle'), 'android { defaultConfig {} }');
  }
}

function cleanupTempDirs() {
  for (const dir of tempDirs) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (err) {
      logWarning(`Failed to clean up ${dir}: ${err.message}`);
    }
  }
  tempDirs = [];
}

// MARK: - Test Cases

const tests = {
  passed: 0,
  failed: 0,
  skipped: 0,
  results: [],
};

async function runTest(name, testFn) {
  try {
    await testFn();
    tests.passed++;
    tests.results.push({ name, status: 'passed' });
    logSuccess(`PASS: ${name}`);
    return true;
  } catch (err) {
    tests.failed++;
    tests.results.push({ name, status: 'failed', error: err.message });
    logError(`FAIL: ${name}`);
    logError(`      ${err.message}`);
    return false;
  }
}

function skipTest(name, reason) {
  tests.skipped++;
  tests.results.push({ name, status: 'skipped', reason });
  logWarning(`SKIP: ${name} - ${reason}`);
}

// MARK: - Fastlane Tool Tests

async function testFastlaneCheck() {
  logSection('Testing fastlane_check');
  
  await runTest('fastlane_check returns status', async () => {
    const result = await callTool('fastlane_check', {});
    
    if (typeof result.installed !== 'boolean') {
      throw new Error(`Expected installed to be boolean, got ${typeof result.installed}`);
    }
    if (!result.message) {
      throw new Error('Expected message in response');
    }
    
    if (result.installed) {
      logInfo(`Fastlane is installed: ${result.version} at ${result.path}`);
    } else {
      logInfo('Fastlane is not installed on this machine');
    }
  });
  
  await runTest('fastlane_check with install=false', async () => {
    const result = await callTool('fastlane_check', { install: false });
    
    if (typeof result.installed !== 'boolean') {
      throw new Error(`Expected installed to be boolean, got ${typeof result.installed}`);
    }
  });
  
  // Only test installation hint if fastlane is not already installed
  const checkResult = await callTool('fastlane_check', {});
  if (!checkResult.installed) {
    await runTest('fastlane_check shows install hint when not installed', async () => {
      const result = await callTool('fastlane_check', {});
      
      if (!result.installInstructions) {
        throw new Error('Expected installInstructions when not installed');
      }
      if (!result.hint) {
        throw new Error('Expected hint about install: true');
      }
    });
  } else {
    skipTest('fastlane_check install hint', 'Fastlane already installed');
  }
}

async function testFastlaneInit() {
  logSection('Testing fastlane_init');
  
  await runTest('fastlane_init creates files for cross-platform project', async () => {
    const dir = createTempDir('init-cross');
    createMockProject(dir, 'cross-platform');
    
    const result = await callTool('fastlane_init', { projectPath: dir });
    
    if (!result.success) {
      throw new Error(`Init failed: ${result.error || 'Unknown error'}`);
    }
    if (result.platform !== 'cross-platform') {
      throw new Error(`Expected cross-platform, got ${result.platform}`);
    }
    if (!fs.existsSync(path.join(result.fastlaneDir, 'Fastfile'))) {
      throw new Error('Fastfile not created');
    }
    if (!fs.existsSync(path.join(result.fastlaneDir, 'Appfile'))) {
      throw new Error('Appfile not created');
    }
  });
  
  await runTest('fastlane_init creates files for iOS-only project', async () => {
    const dir = createTempDir('init-ios');
    createMockProject(dir, 'ios');
    
    const result = await callTool('fastlane_init', { 
      projectPath: dir,
      platform: 'ios',
    });
    
    if (!result.success) {
      throw new Error(`Init failed: ${result.error || 'Unknown error'}`);
    }
    if (!fs.existsSync(path.join(result.fastlaneDir, 'Fastfile'))) {
      throw new Error('Fastfile not created');
    }
  });
  
  await runTest('fastlane_init creates files for Android-only project', async () => {
    const dir = createTempDir('init-android');
    createMockProject(dir, 'android');
    
    const result = await callTool('fastlane_init', { 
      projectPath: dir,
      platform: 'android',
    });
    
    if (!result.success) {
      throw new Error(`Init failed: ${result.error || 'Unknown error'}`);
    }
    if (!fs.existsSync(path.join(result.fastlaneDir, 'Fastfile'))) {
      throw new Error('Fastfile not created');
    }
  });
  
  await runTest('fastlane_init detects already initialized project', async () => {
    const dir = createTempDir('init-existing');
    createMockProject(dir, 'cross-platform');
    
    // First init
    await callTool('fastlane_init', { projectPath: dir });
    
    // Second init should detect existing
    const result = await callTool('fastlane_init', { projectPath: dir });
    
    if (!result.alreadyInitialized) {
      throw new Error('Should detect already initialized project');
    }
  });
  
  await runTest('fastlane_init fails for non-existent path', async () => {
    try {
      const result = await callTool('fastlane_init', { 
        projectPath: '/tmp/non-existent-project-12345',
      });
      
      // If we get here, the tool didn't throw but returned an error
      if (result.success) {
        throw new Error('Should fail for non-existent path');
      }
    } catch (err) {
      // Expected - tool throws an error for non-existent path
      if (!err.message.includes('not found') && !err.message.includes('Project path')) {
        throw err;
      }
    }
  });
}

async function testFastlaneListLanes() {
  logSection('Testing fastlane_list_lanes');
  
  await runTest('fastlane_list_lanes lists lanes from initialized project', async () => {
    const dir = createTempDir('list-lanes');
    createMockProject(dir, 'cross-platform');
    
    // Initialize first
    await callTool('fastlane_init', { projectPath: dir });
    
    // List lanes
    const result = await callTool('fastlane_list_lanes', { projectPath: dir });
    
    if (!result.initialized) {
      throw new Error(`List lanes failed: ${result.message || 'unknown error'}`);
    }
    if (!result.lanes || typeof result.lanes !== 'object') {
      throw new Error('Expected lanes object');
    }
    if (typeof result.totalLanes !== 'number') {
      throw new Error('Expected totalLanes count');
    }
    
    logVerbose(`Found ${result.totalLanes} lanes across ${result.fastlaneDirs?.length || 0} fastlane dirs`);
  });
  
  await runTest('fastlane_list_lanes returns not initialized for project without fastlane', async () => {
    const dir = createTempDir('list-no-fastlane');
    createMockProject(dir, 'ios');
    
    const result = await callTool('fastlane_list_lanes', { projectPath: dir });
    
    // Should return initialized: false (not throw)
    if (result.initialized) {
      throw new Error('Should return initialized: false for project without fastlane');
    }
    if (!result.message) {
      throw new Error('Expected message explaining fastlane not initialized');
    }
  });
}

async function testFastlaneRun() {
  logSection('Testing fastlane_run');
  
  // Check if fastlane is installed
  const checkResult = await callTool('fastlane_check', {});
  
  if (!checkResult.installed) {
    skipTest('fastlane_run with real fastlane', 'Fastlane not installed');
    
    await runTest('fastlane_run returns error when fastlane not installed', async () => {
      const dir = createTempDir('run-no-fastlane');
      createMockProject(dir, 'ios');
      await callTool('fastlane_init', { projectPath: dir });
      
      const result = await callTool('fastlane_run', { 
        projectPath: dir,
        lane: 'beta',
      });
      
      // Should fail gracefully
      if (result.success) {
        throw new Error('Expected failure when fastlane not installed');
      }
    });
  } else {
    await runTest('fastlane_run validates lane exists', async () => {
      const dir = createTempDir('run-validate');
      createMockProject(dir, 'ios');
      await callTool('fastlane_init', { projectPath: dir });
      
      const result = await callTool('fastlane_run', { 
        projectPath: dir,
        lane: 'non_existent_lane_xyz',
      });
      
      // Should fail - lane doesn't exist
      if (result.success) {
        throw new Error('Expected failure for non-existent lane');
      }
    });
    
    skipTest('fastlane_run actual lane execution', 
      'Skipping actual lane execution in E2E tests (requires project setup)');
  }
}

async function testFastlaneMatch() {
  logSection('Testing fastlane_match');
  
  // Match requires actual credentials and setup, so we just test validation
  await runTest('fastlane_match validates project path', async () => {
    const result = await callTool('fastlane_match', { 
      projectPath: '/tmp/non-existent-project-12345',
    });
    
    if (result.success) {
      throw new Error('Should fail for non-existent path');
    }
  });
  
  await runTest('fastlane_match requires iOS project', async () => {
    const dir = createTempDir('match-android');
    createMockProject(dir, 'android');
    
    const result = await callTool('fastlane_match', { 
      projectPath: dir,
    });
    
    if (result.success) {
      throw new Error('Should fail for Android-only project');
    }
  });
  
  skipTest('fastlane_match with credentials', 
    'Requires App Store credentials and certificates repo');
}

// MARK: - Main

async function main() {
  console.log();
  log('╔════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║           Fastlane Tools E2E Test Suite                    ║', colors.cyan + colors.bright);
  log('╚════════════════════════════════════════════════════════════╝', colors.cyan);
  console.log();
  
  try {
    // Setup
    await startServer();
    
    // Run all test suites
    await testFastlaneCheck();
    await testFastlaneInit();
    await testFastlaneListLanes();
    await testFastlaneRun();
    await testFastlaneMatch();
    
  } catch (err) {
    logError(`Test suite failed: ${err.message}`);
    tests.failed++;
  } finally {
    // Cleanup
    stopServer();
    cleanupTempDirs();
  }
  
  // Summary
  logSection('Test Summary');
  
  console.log();
  log(`  Passed:  ${tests.passed}`, colors.green);
  log(`  Failed:  ${tests.failed}`, colors.red);
  log(`  Skipped: ${tests.skipped}`, colors.yellow);
  log(`  Total:   ${tests.passed + tests.failed + tests.skipped}`, colors.bright);
  console.log();
  
  if (tests.failed > 0) {
    log('Failed tests:', colors.red);
    for (const result of tests.results) {
      if (result.status === 'failed') {
        log(`  - ${result.name}: ${result.error}`, colors.red);
      }
    }
    console.log();
  }
  
  const exitCode = tests.failed > 0 ? 1 : 0;
  log(exitCode === 0 ? '✅ All tests passed!' : '❌ Some tests failed', 
      exitCode === 0 ? colors.green : colors.red);
  
  process.exit(exitCode);
}

main().catch((err) => {
  logError(`Unexpected error: ${err.message}`);
  process.exit(1);
});
