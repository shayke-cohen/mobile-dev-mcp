/**
 * MCP Tools Registry
 * 
 * Registers all available tools with the MCP server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DeviceManager } from '../connection/device-manager.js';
import { stateTools, handleStateTool } from './state.js';
import { networkTools, handleNetworkTool } from './network.js';
import { uiTools, handleUiTool } from './ui.js';
import { logsTools, handleLogsTool } from './logs.js';
import { deviceTools, handleDeviceTool } from './device.js';
import { simulatorTools, handleSimulatorTool } from './simulator.js';
import { buildTools, handleBuildTool } from './build.js';
import { actionTools, handleActionTool } from './actions.js';
import { debugTools, handleDebugTool } from './debug.js';

// Tools that require a connected device
const deviceRequiredTools = [
  ...stateTools,
  ...networkTools,
  ...uiTools,
  ...logsTools,
  ...deviceTools,
  ...actionTools,
  ...debugTools,
];

// Tools that work without a connected device (local tools)
const localTools = [
  ...simulatorTools,
  ...buildTools,
];

// Combine all tools
const allTools = [
  ...deviceRequiredTools,
  ...localTools,
];

export function registerAllTools(server: Server, deviceManager: DeviceManager): void {
  // Register list_tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools,
    };
  });

  // Register call_tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      // Check if this is a simulator/local tool (doesn't require device connection)
      if (simulatorTools.some(t => t.name === name)) {
        result = await handleSimulatorTool(name, args || {});
        
        const text = typeof result === 'string'
          ? result
          : JSON.stringify(result, null, 2);

        return {
          content: [{ type: 'text', text }],
        };
      }

      // Check if this is a build tool (doesn't require device connection)
      if (buildTools.some(t => t.name === name)) {
        result = await handleBuildTool(name, args || {});
        
        const text = typeof result === 'string'
          ? result
          : JSON.stringify(result, null, 2);

        return {
          content: [{ type: 'text', text }],
        };
      }

      // For device-required tools, check connection
      if (!deviceManager.hasConnectedDevice()) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ No device connected.\n\nPlease ensure:\n1. Your mobile app is running\n2. The MCP SDK is initialized\n3. The app is connected to ws://localhost:8765\n\n💡 Tip: You can still use simulator tools (list_simulators, boot_simulator, etc.) without an app connection.',
            },
          ],
          isError: true,
        };
      }

      // Route to appropriate handler
      if (stateTools.some(t => t.name === name)) {
        result = await handleStateTool(name, args || {}, deviceManager);
      } else if (networkTools.some(t => t.name === name)) {
        result = await handleNetworkTool(name, args || {}, deviceManager);
      } else if (uiTools.some(t => t.name === name)) {
        result = await handleUiTool(name, args || {}, deviceManager);
      } else if (logsTools.some(t => t.name === name)) {
        result = await handleLogsTool(name, args || {}, deviceManager);
      } else if (deviceTools.some(t => t.name === name)) {
        result = await handleDeviceTool(name, args || {}, deviceManager);
      } else if (actionTools.some(t => t.name === name)) {
        result = await handleActionTool(name, args || {}, deviceManager);
      } else if (debugTools.some(t => t.name === name)) {
        result = await handleDebugTool(name, args || {}, deviceManager);
      } else {
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }

      // Format result
      const text = typeof result === 'string'
        ? result
        : JSON.stringify(result, null, 2);

      return {
        content: [{ type: 'text', text }],
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `❌ Error: ${message}` }],
        isError: true,
      };
    }
  });

  console.error(`[Tools] Registered ${allTools.length} tools (${deviceRequiredTools.length} device, ${localTools.length} simulator)`);
}
