#!/usr/bin/env node

/**
 * MCP Server Test Client
 * 
 * A standalone test client that can test the MCP server without Cursor.
 * It can act as:
 * 1. A mock mobile app (WebSocket client)
 * 2. An MCP client (stdio protocol)
 * 
 * Usage:
 *   node scripts/test-client.js --mode=app     # Simulate mobile app
 *   node scripts/test-client.js --mode=mcp     # Simulate MCP client (Cursor)
 *   node scripts/test-client.js --mode=both    # Run both (full integration test)
 */

const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

// Try to load ws from mcp-server's node_modules (yarn workspace)
let WebSocket;
try {
  WebSocket = require('ws');
} catch (e) {
  // Fallback to mcp-server's ws
  const wsPath = path.join(__dirname, '..', 'packages', 'mcp-server', 'node_modules', 'ws');
  WebSocket = require(wsPath);
}

const WEBSOCKET_PORT = 8765;

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'both';

console.log('');
console.log('🧪 MCP Server Test Client');
console.log('=========================');
console.log(`Mode: ${mode}`);
console.log('');

// ===================== Mock Mobile App (WebSocket Client) =====================

class MockMobileApp {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.state = {
      cart: [
        { productId: '1', name: 'Test Product', price: 29.99, quantity: 2 }
      ],
      user: { id: 'user_123', name: 'Test User', email: 'test@example.com' },
      products: [
        { id: '1', name: 'Test Product', price: 29.99, category: 'Test' }
      ]
    };
    this.featureFlags = { dark_mode: false, new_checkout: true };
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`📱 Mock App: Connecting to ws://localhost:${WEBSOCKET_PORT}...`);
      
      this.ws = new WebSocket(`ws://localhost:${WEBSOCKET_PORT}`);
      
      this.ws.on('open', () => {
        console.log('📱 Mock App: Connected!');
        this.connected = true;
        
        // Send registration
        this.send({
          type: 'register',
          platform: 'test',
          device: {
            platform: 'test',
            version: '1.0.0',
            model: 'Test Device'
          }
        });
        
        resolve();
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });
      
      this.ws.on('error', (error) => {
        console.log(`📱 Mock App: Error - ${error.message}`);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log('📱 Mock App: Disconnected');
        this.connected = false;
      });
    });
  }

  handleMessage(message) {
    const { id, method, params } = message;
    
    if (!method) return; // Ignore non-command messages
    
    console.log(`📱 Mock App: Received command - ${method}`);
    
    let result;
    try {
      switch (method) {
        case 'get_app_state':
          result = params?.key ? { [params.key]: this.state[params.key] } : this.state;
          break;
        case 'list_feature_flags':
          result = this.featureFlags;
          break;
        case 'toggle_feature_flag':
          const key = params.key;
          this.featureFlags[key] = params.value ?? !this.featureFlags[key];
          result = { key, value: this.featureFlags[key] };
          break;
        case 'get_device_info':
          result = { platform: 'test', version: '1.0.0', model: 'Test Device', isSimulator: true };
          break;
        case 'get_app_info':
          result = { name: 'Test App', version: '1.0.0', bundleId: 'com.test.app', environment: 'test' };
          break;
        case 'get_logs':
          result = [{ level: 'info', message: 'Test log', timestamp: Date.now() }];
          break;
        case 'list_network_requests':
          result = [{ id: 'req_1', url: 'https://api.test.com/data', method: 'GET', status: 200 }];
          break;
        default:
          throw new Error(`Unknown method: ${method}`);
      }
      
      this.send({ type: 'response', id, result });
      console.log(`📱 Mock App: Responded to ${method}`);
    } catch (error) {
      this.send({ type: 'response', id, error: error.message });
      console.log(`📱 Mock App: Error handling ${method} - ${error.message}`);
    }
  }

  send(data) {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(data));
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// ===================== MCP Client (Simulating Cursor) =====================

class MCPClient {
  constructor() {
    this.server = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.buffer = '';
  }

  start() {
    return new Promise((resolve, reject) => {
      const serverPath = path.join(__dirname, '..', 'packages', 'mcp-server', 'dist', 'index.js');
      
      console.log('🖥️  MCP Client: Starting server via stdio...');
      
      this.server = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, MCP_LOG_LEVEL: 'error' }
      });
      
      this.server.stdout.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });
      
      this.server.stderr.on('data', (data) => {
        // Server logs go to stderr, we can ignore or show them
        const msg = data.toString().trim();
        if (msg && !msg.includes('[MCP Server]')) {
          console.log(`🖥️  MCP Server: ${msg}`);
        }
      });
      
      this.server.on('error', (error) => {
        console.log(`🖥️  MCP Client: Server error - ${error.message}`);
        reject(error);
      });
      
      this.server.on('close', (code) => {
        console.log(`🖥️  MCP Client: Server closed with code ${code}`);
      });
      
      // Give server time to start
      setTimeout(() => {
        console.log('🖥️  MCP Client: Server ready');
        resolve();
      }, 1000);
    });
  }

  processBuffer() {
    // MCP uses JSON-RPC over newline-delimited JSON
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        this.handleResponse(message);
      } catch (e) {
        // Not JSON, might be server output
      }
    }
  }

  handleResponse(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      
      if (message.error) {
        reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        resolve(message.result);
      }
    }
  }

  async call(method, params = {}) {
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
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  async listTools() {
    console.log('🖥️  MCP Client: Requesting tool list...');
    const result = await this.call('tools/list');
    return result.tools;
  }

  async callTool(name, args = {}) {
    console.log(`🖥️  MCP Client: Calling tool "${name}"...`);
    const result = await this.call('tools/call', { name, arguments: args });
    return result;
  }

  stop() {
    if (this.server) {
      this.server.kill();
    }
  }
}

// ===================== Interactive Test Runner =====================

async function runInteractiveTests() {
  const mockApp = new MockMobileApp();
  const mcpClient = new MCPClient();
  
  try {
    // Start server and mock app
    await mcpClient.start();
    
    // Wait a bit for WebSocket server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Connect mock app
    try {
      await mockApp.connect();
    } catch (e) {
      console.log('📱 Mock App: Could not connect (server may not have WebSocket ready yet)');
    }
    
    // Interactive menu
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const showMenu = () => {
      console.log('');
      console.log('Available commands:');
      console.log('  1. List all tools');
      console.log('  2. List simulators');
      console.log('  3. Get app state');
      console.log('  4. Get device info');
      console.log('  5. List feature flags');
      console.log('  6. Get logs');
      console.log('  7. Custom tool call');
      console.log('  q. Quit');
      console.log('');
    };
    
    const prompt = () => {
      rl.question('> ', async (answer) => {
        try {
          switch (answer.trim()) {
            case '1':
              const tools = await mcpClient.listTools();
              console.log(`\n📋 Available tools (${tools.length}):`);
              tools.forEach(t => console.log(`   - ${t.name}: ${t.description?.substring(0, 60)}...`));
              break;
              
            case '2':
              const sims = await mcpClient.callTool('list_simulators');
              console.log('\n📱 Simulators:');
              console.log(sims.content[0].text);
              break;
              
            case '3':
              const state = await mcpClient.callTool('get_app_state');
              console.log('\n📊 App State:');
              console.log(state.content[0].text);
              break;
              
            case '4':
              const device = await mcpClient.callTool('get_device_info');
              console.log('\n📱 Device Info:');
              console.log(device.content[0].text);
              break;
              
            case '5':
              const flags = await mcpClient.callTool('list_feature_flags');
              console.log('\n🚩 Feature Flags:');
              console.log(flags.content[0].text);
              break;
              
            case '6':
              const logs = await mcpClient.callTool('get_logs', { limit: 10 });
              console.log('\n📝 Logs:');
              console.log(logs.content[0].text);
              break;
              
            case '7':
              rl.question('Tool name: ', async (toolName) => {
                rl.question('Args (JSON): ', async (argsJson) => {
                  try {
                    const args = argsJson ? JSON.parse(argsJson) : {};
                    const result = await mcpClient.callTool(toolName, args);
                    console.log('\n📤 Result:');
                    console.log(result.content[0].text);
                  } catch (e) {
                    console.log(`❌ Error: ${e.message}`);
                  }
                  showMenu();
                  prompt();
                });
              });
              return;
              
            case 'q':
            case 'quit':
            case 'exit':
              console.log('\n👋 Goodbye!');
              rl.close();
              mockApp.close();
              mcpClient.stop();
              process.exit(0);
              return;
              
            default:
              console.log('Unknown command');
          }
        } catch (error) {
          console.log(`❌ Error: ${error.message}`);
        }
        
        showMenu();
        prompt();
      });
    };
    
    showMenu();
    prompt();
    
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    mockApp.close();
    mcpClient.stop();
    process.exit(1);
  }
}

// ===================== Automated Test Runner =====================

async function runAutomatedTests() {
  console.log('Running automated tests...\n');
  
  const mcpClient = new MCPClient();
  const mockApp = new MockMobileApp();
  let passed = 0;
  let failed = 0;
  
  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`  ❌ ${name}: ${error.message}`);
      failed++;
    }
  };
  
  try {
    await mcpClient.start();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      await mockApp.connect();
    } catch (e) {
      console.log('  ⚠️  Mock app could not connect (some tests may fail)');
    }
    
    console.log('\n📋 Tool Tests:');
    
    await test('List tools', async () => {
      const tools = await mcpClient.listTools();
      if (!Array.isArray(tools) || tools.length === 0) {
        throw new Error('No tools returned');
      }
    });
    
    await test('List simulators (local tool)', async () => {
      const result = await mcpClient.callTool('list_simulators');
      if (!result.content) {
        throw new Error('Invalid response');
      }
    });
    
    if (mockApp.connected) {
      console.log('\n📱 App Integration Tests:');
      
      await test('Get app state', async () => {
        const result = await mcpClient.callTool('get_app_state');
        if (result.isError) {
          throw new Error(result.content[0].text);
        }
      });
      
      await test('Get device info', async () => {
        const result = await mcpClient.callTool('get_device_info');
        if (result.isError) {
          throw new Error(result.content[0].text);
        }
      });
      
      await test('List feature flags', async () => {
        const result = await mcpClient.callTool('list_feature_flags');
        if (result.isError) {
          throw new Error(result.content[0].text);
        }
      });
    }
    
    console.log('\n=========================');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    
  } catch (error) {
    console.error(`\nFatal error: ${error.message}`);
    failed++;
  } finally {
    mockApp.close();
    mcpClient.stop();
    process.exit(failed > 0 ? 1 : 0);
  }
}

// ===================== Main =====================

async function main() {
  switch (mode) {
    case 'app':
      // Just run mock app
      const app = new MockMobileApp();
      try {
        await app.connect();
        console.log('📱 Mock App running. Press Ctrl+C to exit.');
        process.on('SIGINT', () => {
          app.close();
          process.exit(0);
        });
      } catch (e) {
        console.log(`Failed to connect: ${e.message}`);
        console.log('Make sure the MCP server is running first.');
        process.exit(1);
      }
      break;
      
    case 'mcp':
      // Run MCP client only (interactive)
      await runInteractiveTests();
      break;
      
    case 'test':
      // Run automated tests
      await runAutomatedTests();
      break;
      
    case 'both':
    default:
      // Run interactive tests with both
      await runInteractiveTests();
      break;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
