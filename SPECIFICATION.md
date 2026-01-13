# Mobile Developer MCP - Complete Project Specification

> A universal Model Context Protocol (MCP) server that connects Cursor IDE to live mobile applications via SDK integration, enabling AI-assisted development through bidirectional real-time communication.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [MCP Server](#3-mcp-server)
4. [Platform SDKs](#4-platform-sdks)
5. [MCP Tools Reference](#5-mcp-tools-reference)
6. [Sample Applications](#6-sample-applications)
7. [Auto-Instrumentation](#7-auto-instrumentation)
8. [Security Model](#8-security-model)
9. [Development Roadmap](#9-development-roadmap)
10. [Project Structure](#10-project-structure)

---

## 1. Executive Summary

### Vision
Create a developer tool that gives Cursor's AI agent direct access to live mobile applications, enabling:
- **Real-time debugging** with full context
- **State inspection** and modification
- **Performance profiling** with actionable insights
- **Hot patching** without rebuilds
- **Automated testing** from natural language

### Key Differentiators
| vs Existing Tools | Mobile Dev MCP Advantage |
|------------------|--------------------------|
| Flipper/RN Debugger | AI can act on data, not just display it |
| Sentry/Crashlytics | Bidirectional - modify state, not just observe |
| Hot Reload | AI-driven targeted fixes, works for native too |

### Platform Support
| Platform | SDK | Priority |
|----------|-----|----------|
| React Native | TypeScript | P0 |
| iOS (Swift/SwiftUI) | Swift | P0 |
| Android (Kotlin/Compose) | Kotlin | P0 |
| Flutter | Dart | P1 |

---

## 2. Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CURSOR IDE                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   AI Agent (Claude)                      │    │
│  │         "Debug the crash" → calls MCP tools              │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │ stdio (JSON-RPC 2.0)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MCP SERVER (Node.js)                        │
│  ┌───────────────────────┐  ┌───────────────────────────────┐   │
│  │   Tool Registry       │  │    Connection Manager          │   │
│  │   - 40+ tools         │  │    - WebSocket (port 8765)     │   │
│  │   - State, Network    │  │    - Device registry           │   │
│  │   - Performance, etc  │  │    - Session management        │   │
│  └───────────────────────┘  └───────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket (ws://localhost:8765)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MOBILE APP (with SDK)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Platform SDK                            │  │
│  │    React Native / Swift / Kotlin / Flutter                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Adapters: State | Network | UI | Performance | Logs      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Communication Flow

```
1. App starts → SDK connects to ws://localhost:8765
2. SDK sends handshake: { platform, appName, appVersion }
3. MCP Server acknowledges connection
4. Cursor agent calls tool (e.g., get_app_state)
5. MCP Server forwards command to SDK via WebSocket
6. SDK executes command, returns result
7. MCP Server returns result to Cursor
8. (Optional) App pushes events (errors, state changes) proactively
```

### Protocol Format (JSON-RPC 2.0)

```json
// Request: Cursor → MCP Server → App
{
  "jsonrpc": "2.0",
  "id": "req_abc123",
  "method": "get_app_state",
  "params": { "path": "user.profile" }
}

// Response: App → MCP Server → Cursor
{
  "jsonrpc": "2.0",
  "id": "req_abc123",
  "result": {
    "state": { "user": { "profile": { "name": "John" } } },
    "timestamp": "2025-01-13T10:30:00Z"
  }
}

// Event (Push): App → MCP Server → Cursor
{
  "jsonrpc": "2.0",
  "method": "app.error",
  "params": {
    "type": "crash",
    "message": "TypeError: Cannot read property...",
    "stack": "...",
    "context": { "route": "/checkout", "lastAction": "tapButton" }
  }
}
```

---

## 3. MCP Server

### 3.1 Overview

The MCP Server is a Node.js application that:
- Connects to Cursor via stdio (standard MCP transport)
- Runs a WebSocket server for mobile app connections
- Manages multiple device connections
- Routes commands between Cursor and apps

### 3.2 Directory Structure

```
packages/mcp-server/
├── src/
│   ├── index.ts                 # Entry point
│   ├── server.ts                # MCP server setup
│   ├── tools/                   # Tool implementations
│   │   ├── index.ts             # Tool registry
│   │   ├── state.ts             # State inspection tools
│   │   ├── network.ts           # Network tools
│   │   ├── performance.ts       # Performance tools
│   │   ├── ui.ts                # UI/Component tools
│   │   ├── logs.ts              # Logging tools
│   │   ├── errors.ts            # Error handling tools
│   │   ├── testing.ts           # Testing/automation tools
│   │   ├── config.ts            # Config/feature flags
│   │   └── device.ts            # Device info tools
│   ├── connection/
│   │   ├── websocket-server.ts  # WebSocket server
│   │   ├── device-manager.ts    # Device registry
│   │   ├── protocol.ts          # Message protocol
│   │   └── auth.ts              # Authentication
│   └── utils/
│       ├── logger.ts
│       ├── serialization.ts
│       └── validation.ts
├── package.json
├── tsconfig.json
└── README.md
```

### 3.3 Core Implementation

```typescript
// src/index.ts
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServer } from './connection/websocket-server.js';
import { DeviceManager } from './connection/device-manager.js';
import { registerAllTools } from './tools/index.js';

async function main() {
  // Create MCP server
  const server = new Server({
    name: 'mobile-dev-mcp',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {},
      resources: {}
    }
  });

  // Start WebSocket server for mobile apps
  const wsServer = new WebSocketServer({ port: 8765 });
  const deviceManager = new DeviceManager(wsServer);

  // Register all MCP tools
  registerAllTools(server, deviceManager);

  // Connect to Cursor via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Mobile Dev MCP Server running');
  console.error('- Listening for apps on ws://localhost:8765');
  console.error('- Connected to Cursor via stdio');
}

main().catch(console.error);
```

### 3.4 Device Manager

```typescript
// src/connection/device-manager.ts

export interface Device {
  id: string;
  platform: 'ios' | 'android' | 'react-native' | 'flutter';
  appName: string;
  appVersion: string;
  connection: WebSocket;
  lastSeen: Date;
  capabilities: string[];
}

export class DeviceManager {
  private devices: Map<string, Device> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();

  constructor(private wsServer: WebSocketServer) {
    this.wsServer.on('connection', this.handleConnection.bind(this));
  }

  async sendCommand(deviceId: string | null, command: MCPCommand): Promise<any> {
    const device = deviceId 
      ? this.devices.get(deviceId) 
      : this.getPrimaryDevice();
      
    if (!device) {
      throw new Error('No device connected');
    }

    return new Promise((resolve, reject) => {
      const requestId = generateId();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 10000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      
      device.connection.send(JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        method: command.method,
        params: command.params
      }));
    });
  }

  getConnectedDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  getPrimaryDevice(): Device | null {
    return this.devices.values().next().value || null;
  }
}
```

### 3.5 Cursor Configuration

```json
// ~/.cursor/mcp.json or .cursor/mcp.json (project)
{
  "mcpServers": {
    "mobile-dev-mcp": {
      "command": "npx",
      "args": ["-y", "@mobile-dev-mcp/server@latest"],
      "env": {
        "MCP_PORT": "8765",
        "MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

---

## 4. Platform SDKs

### 4.1 SDK Architecture (Shared Concepts)

All SDKs implement the same core concepts:

```
SDK Core
├── Connection Layer (WebSocket client)
├── Command Dispatcher (routes commands to adapters)
├── Adapters
│   ├── StateAdapter      # App state exposure
│   ├── NetworkAdapter    # Request interception
│   ├── UIAdapter         # Component/view inspection
│   ├── PerformanceAdapter
│   ├── LogAdapter
│   └── ErrorAdapter
└── Security Layer (dev-only checks)
```

---

### 4.2 React Native SDK

#### Installation

```bash
npm install @mobile-dev-mcp/react-native
# or
yarn add @mobile-dev-mcp/react-native
```

#### Directory Structure

```
packages/sdk-react-native/
├── src/
│   ├── index.ts                  # Public API exports
│   ├── MCPBridge.ts              # Main bridge class
│   ├── adapters/
│   │   ├── StateAdapter.ts       # Redux/Zustand integration
│   │   ├── NetworkAdapter.ts     # fetch/XHR interception
│   │   ├── ComponentAdapter.ts   # React DevTools integration
│   │   ├── PerformanceAdapter.ts # Performance tracking
│   │   ├── LogAdapter.ts         # Console interception
│   │   └── ErrorAdapter.ts       # Error boundary integration
│   ├── connection/
│   │   └── WebSocketClient.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       └── serialization.ts
├── ios/                          # Native iOS module
│   ├── MCPNativeModule.h
│   └── MCPNativeModule.m
├── android/                      # Native Android module
│   └── src/main/java/com/mobiledevmcp/
│       ├── MCPNativeModule.kt
│       └── MCPPackage.kt
├── package.json
└── README.md
```

#### Basic Usage

```typescript
// App.tsx
import { MCPBridge } from '@mobile-dev-mcp/react-native';
import store from './store';
import { navigationRef } from './navigation';

if (__DEV__) {
  MCPBridge.initialize({
    serverUrl: 'ws://localhost:8765',
    autoConnect: true
  });
  
  // Expose Redux store
  MCPBridge.exposeState('store', () => store.getState());
  
  // Expose navigation
  MCPBridge.exposeState('navigation', () => 
    navigationRef.current?.getCurrentRoute()
  );
  
  // Enable auto-instrumentation
  MCPBridge.enableNetworkInterception();
  MCPBridge.enableComponentInspection();
  MCPBridge.enablePerformanceTracking();
}
```

#### Core Implementation

```typescript
// src/MCPBridge.ts
import { StateAdapter } from './adapters/StateAdapter';
import { NetworkAdapter } from './adapters/NetworkAdapter';
import { ComponentAdapter } from './adapters/ComponentAdapter';
import { WebSocketClient } from './connection/WebSocketClient';

interface MCPConfig {
  serverUrl: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  timeout?: number;
}

export class MCPBridge {
  private static instance: MCPBridge | null = null;
  private wsClient: WebSocketClient;
  private adapters: Map<string, any> = new Map();
  
  static initialize(config: MCPConfig): void {
    if (!__DEV__) {
      console.warn('[MCP] SDK only works in development mode');
      return;
    }
    
    if (this.instance) {
      console.warn('[MCP] Already initialized');
      return;
    }
    
    this.instance = new MCPBridge(config);
  }
  
  private constructor(config: MCPConfig) {
    this.wsClient = new WebSocketClient(config.serverUrl, {
      reconnectInterval: config.reconnectInterval ?? 3000,
      timeout: config.timeout ?? 10000
    });
    
    // Initialize adapters
    this.adapters.set('state', new StateAdapter());
    this.adapters.set('network', new NetworkAdapter());
    this.adapters.set('component', new ComponentAdapter());
    
    // Setup command routing
    this.wsClient.onCommand = this.handleCommand.bind(this);
    
    if (config.autoConnect) {
      this.wsClient.connect();
    }
  }
  
  private async handleCommand(command: MCPCommand): Promise<any> {
    const { method, params } = command;
    
    // Route to appropriate adapter
    switch (method) {
      case 'get_app_state':
        return this.adapters.get('state').getState(params);
      case 'list_network_requests':
        return this.adapters.get('network').listRequests(params);
      case 'get_component_tree':
        return this.adapters.get('component').getTree(params);
      case 'capture_screenshot':
        return this.captureScreenshot(params);
      // ... more handlers
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }
  
  // Public API
  static exposeState(key: string, getter: () => any): void {
    this.instance?.adapters.get('state').expose(key, getter);
  }
  
  static enableNetworkInterception(): void {
    this.instance?.adapters.get('network').enable();
  }
  
  static enableComponentInspection(): void {
    this.instance?.adapters.get('component').enable();
  }
}
```

---

### 4.3 iOS SDK (Swift)

#### Installation

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/mobile-dev-mcp/sdk-ios.git", from: "1.0.0")
]
```

#### Directory Structure

```
packages/sdk-ios/
├── Sources/MobileDevMCP/
│   ├── MCPBridge.swift           # Main bridge
│   ├── Adapters/
│   │   ├── StateAdapter.swift
│   │   ├── NetworkAdapter.swift
│   │   ├── UIAdapter.swift
│   │   ├── PerformanceAdapter.swift
│   │   └── LogAdapter.swift
│   ├── Connection/
│   │   ├── WebSocketClient.swift
│   │   └── Protocol.swift
│   └── Types/
│       └── MCPTypes.swift
├── Package.swift
└── README.md
```

#### Basic Usage

```swift
// AppDelegate.swift or App.swift
import MobileDevMCP

#if DEBUG
@main
struct MyApp: App {
    init() {
        MCPBridge.shared.initialize(serverUrl: "ws://localhost:8765")
        
        // Expose view models
        MCPBridge.shared.exposeState(key: "user") {
            UserViewModel.shared.currentUser
        }
        
        // Enable features
        MCPBridge.shared.enableNetworkInterception()
        MCPBridge.shared.enableUIInspection()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
#else
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
#endif
```

#### Core Implementation

```swift
// Sources/MobileDevMCP/MCPBridge.swift
import Foundation
import Combine

public final class MCPBridge {
    public static let shared = MCPBridge()
    
    private var wsClient: WebSocketClient?
    private var stateAdapter: StateAdapter
    private var networkAdapter: NetworkAdapter
    private var uiAdapter: UIAdapter
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        self.stateAdapter = StateAdapter()
        self.networkAdapter = NetworkAdapter()
        self.uiAdapter = UIAdapter()
    }
    
    public func initialize(serverUrl: String) {
        #if DEBUG
        guard wsClient == nil else {
            print("[MCP] Already initialized")
            return
        }
        
        self.wsClient = WebSocketClient(url: URL(string: serverUrl)!)
        self.wsClient?.delegate = self
        self.wsClient?.connect()
        
        print("[MCP] Initialized, connecting to \(serverUrl)")
        #else
        print("[MCP] SDK only works in DEBUG builds")
        #endif
    }
    
    public func exposeState(key: String, getter: @escaping () -> Any?) {
        stateAdapter.register(key: key, getter: getter)
    }
    
    public func enableNetworkInterception() {
        networkAdapter.enable()
    }
    
    public func enableUIInspection() {
        uiAdapter.enable()
    }
}

extension MCPBridge: WebSocketClientDelegate {
    func didReceiveCommand(_ command: MCPCommand) {
        Task { @MainActor in
            do {
                let result: Any?
                
                switch command.method {
                case "get_app_state":
                    result = try await stateAdapter.getState(params: command.params)
                case "capture_screenshot":
                    result = try await uiAdapter.captureScreenshot()
                case "list_network_requests":
                    result = try await networkAdapter.listRequests(params: command.params)
                case "get_component_tree":
                    result = try await uiAdapter.getViewHierarchy()
                default:
                    throw MCPError.unknownMethod(command.method)
                }
                
                wsClient?.sendResponse(id: command.id, result: result)
            } catch {
                wsClient?.sendError(id: command.id, error: error.localizedDescription)
            }
        }
    }
}
```

---

### 4.4 Android SDK (Kotlin)

#### Installation

```kotlin
// build.gradle.kts (app level)
dependencies {
    debugImplementation("com.mobiledevmcp:sdk-android:1.0.0")
}
```

#### Directory Structure

```
packages/sdk-android/
├── src/main/kotlin/com/mobiledevmcp/
│   ├── MCPBridge.kt              # Main bridge
│   ├── adapters/
│   │   ├── StateAdapter.kt
│   │   ├── NetworkAdapter.kt
│   │   ├── UIAdapter.kt
│   │   ├── PerformanceAdapter.kt
│   │   └── LogAdapter.kt
│   ├── connection/
│   │   ├── WebSocketClient.kt
│   │   └── Protocol.kt
│   └── types/
│       └── MCPTypes.kt
├── build.gradle.kts
└── README.md
```

#### Basic Usage

```kotlin
// MainApplication.kt
import com.mobiledevmcp.MCPBridge

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        if (BuildConfig.DEBUG) {
            MCPBridge.initialize(
                context = this,
                serverUrl = "ws://localhost:8765"
            )
            
            // Expose ViewModels
            MCPBridge.exposeState("user") {
                UserViewModel.currentUser.value
            }
            
            // Enable features
            MCPBridge.enableNetworkInterception()
            MCPBridge.enableUIInspection()
        }
    }
}
```

#### Core Implementation

```kotlin
// src/main/kotlin/com/mobiledevmcp/MCPBridge.kt
package com.mobiledevmcp

import android.content.Context
import kotlinx.coroutines.*

object MCPBridge {
    private var wsClient: WebSocketClient? = null
    private val stateAdapter = StateAdapter()
    private val networkAdapter = NetworkAdapter()
    private val uiAdapter = UIAdapter()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    fun initialize(context: Context, serverUrl: String) {
        if (!BuildConfig.DEBUG) {
            Log.w("MCP", "SDK only works in DEBUG builds")
            return
        }
        
        if (wsClient != null) {
            Log.w("MCP", "Already initialized")
            return
        }
        
        uiAdapter.setContext(context)
        wsClient = WebSocketClient(serverUrl).apply {
            onCommand = ::handleCommand
            connect()
        }
        
        Log.d("MCP", "Initialized, connecting to $serverUrl")
    }
    
    private fun handleCommand(command: MCPCommand) {
        scope.launch {
            try {
                val result: Any? = when (command.method) {
                    "get_app_state" -> stateAdapter.getState(command.params)
                    "capture_screenshot" -> uiAdapter.captureScreenshot()
                    "list_network_requests" -> networkAdapter.listRequests(command.params)
                    "get_component_tree" -> uiAdapter.getViewHierarchy()
                    else -> throw MCPException("Unknown method: ${command.method}")
                }
                
                wsClient?.sendResponse(command.id, result)
            } catch (e: Exception) {
                wsClient?.sendError(command.id, e.message ?: "Unknown error")
            }
        }
    }
    
    fun exposeState(key: String, getter: () -> Any?) {
        stateAdapter.register(key, getter)
    }
    
    fun enableNetworkInterception() {
        networkAdapter.enable()
    }
    
    fun enableUIInspection() {
        uiAdapter.enable()
    }
}
```

---

## 5. MCP Tools Reference

### 5.1 Tool Categories

| Category | Tools | Priority | Description |
|----------|-------|----------|-------------|
| **State & Data** | 4 | P0 | Inspect app state, storage, database |
| **UI & Components** | 4 | P0 | Component tree, screenshots, inspection |
| **Network** | 4 | P0 | Request capture, mocking, replay |
| **Logs & Errors** | 4 | P0 | Log retrieval, crash reports |
| **Performance** | 4 | P1 | Profiling, render metrics |
| **Code Injection** | 4 | P1 | Hot patching, live updates |
| **Config & Flags** | 4 | P1 | Feature flags, config override |
| **Testing** | 4 | P1 | Interaction simulation |
| **Session & Analytics** | 4 | P2 | Session replay, events |
| **Device Info** | 3 | P1 | Device/app metadata |

### 5.2 P0 Tools (MVP)

#### State & Data Tools

```typescript
// get_app_state
{
  name: "get_app_state",
  description: "Retrieve current application state (Redux/Zustand/ViewModel)",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Dot notation path (e.g., 'user.profile')" },
      deep: { type: "boolean", description: "Include nested objects" }
    }
  }
}

// query_storage
{
  name: "query_storage",
  description: "Query AsyncStorage/UserDefaults/SharedPreferences",
  inputSchema: {
    type: "object",
    properties: {
      key: { type: "string", description: "Specific key or null for all" },
      pattern: { type: "string", description: "Regex pattern to match keys" }
    }
  }
}

// query_database
{
  name: "query_database",
  description: "Execute SQL query on local SQLite/Realm database",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "SQL query to execute" },
      database: { type: "string", description: "Database name if multiple" }
    },
    required: ["query"]
  }
}

// get_navigation_state
{
  name: "get_navigation_state",
  description: "Get current navigation stack/route information",
  inputSchema: { type: "object", properties: {} }
}
```

#### UI & Component Tools

```typescript
// get_component_tree
{
  name: "get_component_tree",
  description: "Get React/SwiftUI/Compose component hierarchy",
  inputSchema: {
    type: "object",
    properties: {
      rootComponent: { type: "string" },
      includeProps: { type: "boolean" },
      includeState: { type: "boolean" },
      depth: { type: "number" }
    }
  }
}

// capture_screenshot
{
  name: "capture_screenshot",
  description: "Capture current screen as base64 image",
  inputSchema: {
    type: "object",
    properties: {
      label: { type: "string" },
      compareWithBaseline: { type: "boolean" }
    }
  }
}

// inspect_element
{
  name: "inspect_element",
  description: "Get detailed info about UI element at coordinates",
  inputSchema: {
    type: "object",
    properties: {
      x: { type: "number" },
      y: { type: "number" }
    },
    required: ["x", "y"]
  }
}

// get_layout_tree
{
  name: "get_layout_tree",
  description: "Get view hierarchy with layout information",
  inputSchema: {
    type: "object",
    properties: {
      includeHidden: { type: "boolean" }
    }
  }
}
```

#### Network Tools

```typescript
// list_network_requests
{
  name: "list_network_requests",
  description: "Get recent network requests and responses",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number" },
      filter: {
        type: "object",
        properties: {
          url: { type: "string" },
          method: { type: "string" },
          statusCode: { type: "number" }
        }
      }
    }
  }
}

// replay_network_request
{
  name: "replay_network_request",
  description: "Re-execute a previous network request",
  inputSchema: {
    type: "object",
    properties: {
      requestId: { type: "string" },
      modifications: { type: "object" }
    },
    required: ["requestId"]
  }
}

// mock_network_request
{
  name: "mock_network_request",
  description: "Intercept and mock specific network requests",
  inputSchema: {
    type: "object",
    properties: {
      urlPattern: { type: "string" },
      mockResponse: {
        type: "object",
        properties: {
          statusCode: { type: "number" },
          body: { type: "object" },
          delay: { type: "number" }
        }
      }
    },
    required: ["urlPattern", "mockResponse"]
  }
}

// clear_network_mocks
{
  name: "clear_network_mocks",
  description: "Remove all network mocks",
  inputSchema: {
    type: "object",
    properties: {
      mockId: { type: "string" }
    }
  }
}
```

#### Logs & Error Tools

```typescript
// get_logs
{
  name: "get_logs",
  description: "Retrieve application logs",
  inputSchema: {
    type: "object",
    properties: {
      level: { type: "string", enum: ["debug", "info", "warn", "error"] },
      filter: { type: "string" },
      limit: { type: "number" },
      since: { type: "string" }
    }
  }
}

// get_recent_errors
{
  name: "get_recent_errors",
  description: "Retrieve recent errors and exceptions with context",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number" },
      severity: { type: "string", enum: ["error", "warning"] }
    }
  }
}

// get_crash_reports
{
  name: "get_crash_reports",
  description: "Get crash logs with full context",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number" }
    }
  }
}

// stream_logs
{
  name: "stream_logs",
  description: "Start streaming logs in real-time",
  inputSchema: {
    type: "object",
    properties: {
      level: { type: "string" },
      filter: { type: "string" }
    }
  }
}
```

### 5.3 P1 Tools (Phase 2)

Full specifications for: Performance profiling, Code injection, Feature flags, Testing automation, Device info.

*(See detailed specifications in the chat history)*

---

## 6. Sample Applications

### 6.1 React Native Demo App

```
examples/react-native-demo/
├── src/
│   ├── App.tsx                 # App entry with MCP setup
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── ProductListScreen.tsx
│   │   ├── ProductDetailScreen.tsx
│   │   └── CheckoutScreen.tsx
│   ├── store/
│   │   ├── index.ts            # Redux store
│   │   ├── userSlice.ts
│   │   └── cartSlice.ts
│   ├── services/
│   │   └── api.ts              # API service
│   └── navigation/
│       └── index.tsx
├── package.json
├── babel.config.js             # With MCP babel plugin
└── README.md
```

### 6.2 iOS SwiftUI Demo App

```
examples/ios-swiftui-demo/
├── MobileDevMCPDemo/
│   ├── App.swift               # App entry with MCP setup
│   ├── Views/
│   │   ├── HomeView.swift
│   │   ├── ProductListView.swift
│   │   └── CheckoutView.swift
│   ├── ViewModels/
│   │   ├── UserViewModel.swift
│   │   └── CartViewModel.swift
│   └── Services/
│       └── APIService.swift
├── MobileDevMCPDemo.xcodeproj
├── Package.swift
└── README.md
```

### 6.3 Android Compose Demo App

```
examples/android-compose-demo/
├── app/
│   └── src/main/
│       ├── kotlin/com/mobiledevmcp/demo/
│       │   ├── MainActivity.kt
│       │   ├── MainApplication.kt   # MCP setup
│       │   ├── ui/
│       │   │   ├── screens/
│       │   │   │   ├── HomeScreen.kt
│       │   │   │   └── ProductScreen.kt
│       │   │   └── theme/
│       │   └── viewmodel/
│       │       ├── UserViewModel.kt
│       │       └── CartViewModel.kt
│       └── res/
├── build.gradle.kts
└── README.md
```

---

## 7. Auto-Instrumentation

### 7.1 Babel Plugin (React Native)

Minimizes manual SDK calls via compile-time transformation.

```javascript
// babel.config.js
module.exports = {
  plugins: [
    ['@mobile-dev-mcp/babel-plugin', {
      autoInstrument: true,
      features: {
        redux: true,          // Auto-wrap configureStore
        navigation: true,      // Auto-attach ref
        network: true,         // Auto-intercept fetch
        performance: true,     // Auto-add timing
        tracing: {            // Function call tracing
          enabled: true,
          include: ['src/**/*.{js,ts,tsx}'],
          exclude: ['**/*.test.js']
        }
      }
    }]
  ]
};
```

### 7.2 What Gets Auto-Injected

**Before (developer code):**
```javascript
const store = configureStore({ reducer: rootReducer });

function fetchUser(id) {
  return fetch(`/api/users/${id}`).then(r => r.json());
}
```

**After (transformed):**
```javascript
const store = MCPBridge.wrapStore(configureStore({ reducer: rootReducer }));

function fetchUser(id) {
  MCPBridge.trace('fetchUser', 'enter', { id });
  return fetch(`/api/users/${id}`)
    .then(r => r.json())
    .then(result => MCPBridge.traceReturn('fetchUser', result));
}
```

### 7.3 Metro Transformer Alternative

```javascript
// metro.config.js
const { getDefaultConfig } = require('metro-config');

module.exports = (async () => {
  const config = await getDefaultConfig();
  return {
    ...config,
    transformer: {
      ...config.transformer,
      babelTransformerPath: require.resolve('@mobile-dev-mcp/metro-transformer')
    }
  };
})();
```

---

## 8. Security Model

### 8.1 Development-Only Enforcement

| Build Type | SDK Active | Bundle Impact |
|-----------|------------|---------------|
| Development | ✅ Yes | +150KB |
| Staging | ⚠️ Optional | +150KB |
| Production | ❌ No | 0KB |

### 8.2 How SDK is Removed in Production

| Platform | Mechanism |
|----------|-----------|
| React Native | `__DEV__` checks + Metro tree shaking |
| iOS | `#if DEBUG` preprocessor |
| Android | `BuildConfig.DEBUG` + ProGuard/R8 |
| Flutter | `kDebugMode` + tree shaking |

### 8.3 Security Layers

```
┌─────────────────────────────────────────────┐
│           Security Layers                    │
├─────────────────────────────────────────────┤
│ 1. Development Mode Only                     │
│    - Compile-time removal in release         │
├─────────────────────────────────────────────┤
│ 2. Localhost Only                           │
│    - SDK only connects to 127.0.0.1         │
├─────────────────────────────────────────────┤
│ 3. Authentication Token                      │
│    - Generated on MCP server start          │
│    - Required in handshake                  │
├─────────────────────────────────────────────┤
│ 4. Code Injection Sandbox                   │
│    - Isolated execution context             │
│    - 5 second timeout                       │
├─────────────────────────────────────────────┤
│ 5. Rate Limiting                            │
│    - Max 100 requests/second                │
└─────────────────────────────────────────────┘
```

---

## 9. Development Roadmap

### Phase 1: MVP (Weeks 1-4)

**Goal:** Basic bidirectional connection with core tools

- [ ] MCP Server
  - [ ] WebSocket server on port 8765
  - [ ] Device manager with handshake
  - [ ] stdio transport to Cursor
  - [ ] P0 tools (state, logs, screenshot, errors)
- [ ] React Native SDK
  - [ ] WebSocket client with reconnection
  - [ ] State adapter
  - [ ] Log adapter
  - [ ] Screenshot capture
- [ ] Documentation
  - [ ] Setup guide
  - [ ] Basic examples

**Deliverable:** Working demo - RN app controlled from Cursor

### Phase 2: Platform Expansion (Weeks 5-8)

**Goal:** iOS and Android native support

- [ ] Swift/iOS SDK (full implementation)
- [ ] Kotlin/Android SDK (full implementation)
- [ ] P1 Tools
  - [ ] Network interception & mocking
  - [ ] Performance profiling
  - [ ] Component tree inspection
- [ ] Sample Apps
  - [ ] iOS SwiftUI demo
  - [ ] Android Compose demo

**Deliverable:** Cross-platform SDK support

### Phase 3: Advanced Features (Weeks 9-12)

**Goal:** Production-ready with advanced capabilities

- [ ] Babel/Metro auto-instrumentation
- [ ] Hot patching / code injection
- [ ] Session replay
- [ ] Visual regression detection
- [ ] Multi-device support
- [ ] Performance optimization
- [ ] Security hardening

**Deliverable:** Production-ready 1.0 release

### Phase 4: Ecosystem (Weeks 13+)

- [ ] Flutter SDK
- [ ] VS Code extension
- [ ] Open source release
- [ ] Documentation website
- [ ] Community examples

---

## 10. Project Structure

### Complete Monorepo Layout

```
mobile-dev-mcp/
├── packages/
│   ├── mcp-server/               # Main MCP server (Node.js)
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── sdk-react-native/         # React Native SDK
│   │   ├── src/
│   │   ├── ios/
│   │   ├── android/
│   │   └── package.json
│   │
│   ├── sdk-ios/                  # Swift/iOS SDK
│   │   ├── Sources/
│   │   └── Package.swift
│   │
│   ├── sdk-android/              # Kotlin/Android SDK
│   │   ├── src/
│   │   └── build.gradle.kts
│   │
│   ├── babel-plugin/             # Babel auto-instrumentation
│   │   ├── src/
│   │   └── package.json
│   │
│   └── shared-types/             # Shared TypeScript types
│       ├── src/
│       └── package.json
│
├── examples/
│   ├── react-native-demo/        # RN demo app
│   ├── ios-swiftui-demo/         # iOS demo app
│   └── android-compose-demo/     # Android demo app
│
├── docs/
│   ├── getting-started.md
│   ├── sdk-api/
│   ├── mcp-tools.md
│   └── architecture.md
│
├── scripts/
│   ├── setup.sh
│   └── publish.sh
│
├── package.json                  # Root package (workspaces)
├── pnpm-workspace.yaml
├── turbo.json                    # Turborepo config
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
│
├── SPECIFICATION.md              # This file
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

### Package Manager Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

```json
// package.json (root)
{
  "name": "mobile-dev-mcp",
  "private": true,
  "workspaces": [
    "packages/*",
    "examples/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^1.11.0",
    "typescript": "^5.3.0"
  }
}
```

---

## Appendix A: Example Workflows

### Workflow 1: Debug Crash

```
User: "App crashed when I tapped checkout"

Agent: Let me investigate...
→ calls get_recent_errors()
→ sees: "TypeError: Cannot read property 'price' of null"

Agent: Found the error. Checking app state...
→ calls get_app_state(path: "cart")
→ sees: { items: [] }

Agent: The cart is empty when it shouldn't be. Let me check logs...
→ calls get_logs(filter: "cart")
→ sees: "Cart cleared after promo code applied"

Agent: Found it! The promo code handler clears the cart incorrectly.
       Here's the fix...
[Agent writes code to fix the bug]
```

### Workflow 2: Optimize Performance

```
User: "The product list is laggy"

Agent: Let me profile it...
→ calls start_performance_profile()
→ calls navigate_to("/products")
→ calls stop_performance_profile()
→ sees: avgFPS: 28, jsThreadBlocks: 45

Agent: Investigating component renders...
→ calls get_render_performance()
→ sees: ProductCard rendered 180 times/sec

Agent: ProductCard is re-rendering excessively.
[Agent applies useMemo/useCallback fix]
[Agent re-profiles: avgFPS: 58]

Agent: Fixed! Performance improved from 28fps to 58fps.
```

---

## Appendix B: Quick Start

### 1-Minute Setup (React Native)

```bash
# 1. Install SDK
npm install @mobile-dev-mcp/react-native

# 2. Add to App.tsx
import '@mobile-dev-mcp/auto-init';  // One line!

# 3. Configure Cursor (~/.cursor/mcp.json)
{
  "mcpServers": {
    "mobile-dev-mcp": {
      "command": "npx",
      "args": ["-y", "@mobile-dev-mcp/server@latest"]
    }
  }
}

# 4. Run app, open Cursor, start debugging!
```

---

*Last updated: January 13, 2025*
