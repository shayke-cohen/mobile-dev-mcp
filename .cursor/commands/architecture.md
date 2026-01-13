# Project Architecture

Explain the mobile-dev-mcp project structure and how the pieces connect.

## Overview

This project enables AI-assisted mobile development in Cursor by providing:
1. An **MCP Server** that Cursor communicates with
2. **Mobile SDKs** that apps integrate to expose runtime data
3. **Demo Apps** showing the integration

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Cursor                               │
│                      (MCP Client)                            │
└─────────────────────────┬───────────────────────────────────┘
                          │ MCP Protocol (stdio)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server                              │
│              (packages/mcp-server)                           │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  State   │ │ Network  │ │    UI    │ │   Logs   │  ...  │
│  │  Tools   │ │  Tools   │ │  Tools   │ │  Tools   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────┬───────────────────────────────────┘
                          │ WebSocket (ws://localhost:8765)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Mobile App                              │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    MCP SDK                            │   │
│  │           (packages/sdk-react-native)                 │   │
│  │                                                       │   │
│  │  • Connects to MCP Server via WebSocket              │   │
│  │  • Handles tool commands                              │   │
│  │  • Exposes app state, network, UI, etc.              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │  Redux/  │ │Navigation│ │    UI    │                    │
│  │ Zustand  │ │  Stack   │ │Components│                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## Package Structure

```
mobile-dev-mcp/
├── packages/
│   ├── mcp-server/          # MCP server (Node.js)
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point
│   │   │   ├── connection/        # WebSocket & device management
│   │   │   ├── tools/             # MCP tool definitions
│   │   │   │   ├── state.ts       # State inspection
│   │   │   │   ├── network.ts     # Network tools
│   │   │   │   ├── ui.ts          # UI inspection
│   │   │   │   ├── logs.ts        # Logging tools
│   │   │   │   ├── device.ts      # Device info
│   │   │   │   ├── simulator.ts   # Simulator control
│   │   │   │   └── build.ts       # Build tools
│   │   │   └── utils/
│   │
│   ├── sdk-react-native/    # React Native SDK
│   │   └── src/
│   │       ├── index.ts           # SDK entry & MCP client
│   │       ├── hooks/             # React hooks
│   │       └── handlers/          # Command handlers
│   │
│   └── babel-plugin-mcp/    # Babel plugin for auto-instrumentation
│
└── examples/
    ├── react-native-demo/   # React Native demo app
    ├── ios-swiftui-demo/    # Native iOS demo
    └── android-compose-demo/ # Native Android demo
```

## Data Flow

1. **User asks Cursor** about the app (e.g., "What's in the cart?")
2. **Cursor calls MCP tool** (e.g., `get_app_state` with path "cart")
3. **MCP Server receives** the tool call via MCP protocol
4. **Server forwards** command to connected mobile app via WebSocket
5. **SDK in app** handles command, reads cart state from Redux
6. **SDK returns** data back through WebSocket
7. **Server returns** result to Cursor via MCP protocol
8. **Cursor shows** the cart contents to the user

## Key Concepts

### MCP Tools
- Defined in `packages/mcp-server/src/tools/`
- Each tool has a name, description, and input schema
- Tools either query the app (via WebSocket) or run locally (simulator/build)

### Device Connection
- Apps connect via WebSocket to `ws://localhost:8765`
- Multiple devices can connect simultaneously
- Server tracks device info and capabilities

### SDK Integration
- App imports and initializes the SDK
- SDK connects to server and registers handlers
- Handlers respond to tool commands with app data

## Adding Features

- **New MCP tool**: Add to appropriate file in `tools/`, update SDK if needed
- **New SDK capability**: Add handler in SDK, expose via tool
- **New platform**: Create SDK for that platform (iOS, Android native)
