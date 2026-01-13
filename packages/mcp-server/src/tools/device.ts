/**
 * Device & App Info Tools
 */

import { DeviceManager } from '../connection/device-manager.js';

export const deviceTools = [
  {
    name: 'get_device_info',
    description: 'Get device specifications and capabilities',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_app_info',
    description: 'Get app metadata, version, and build information',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'list_connected_devices',
    description: 'List all devices currently connected to the MCP server',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'list_feature_flags',
    description: 'Get all feature flags and their current states',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'toggle_feature_flag',
    description: 'Enable/disable a feature flag in real-time (no rebuild needed)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        flagName: {
          type: 'string',
          description: 'Name of the feature flag',
        },
        enabled: {
          type: 'boolean',
          description: 'New state of the flag',
        },
      },
      required: ['flagName', 'enabled'],
    },
  },
  {
    name: 'check_permissions',
    description: 'Check status of device permissions (camera, location, etc.)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        permission: {
          type: 'string',
          description: 'Specific permission to check. Leave empty for all.',
        },
      },
    },
  },
];

export async function handleDeviceTool(
  name: string,
  args: Record<string, unknown>,
  deviceManager: DeviceManager
): Promise<unknown> {
  // Handle list_connected_devices locally (doesn't need app communication)
  if (name === 'list_connected_devices') {
    const devices = deviceManager.getConnectedDevices();
    return {
      devices: devices.map(d => ({
        id: d.id,
        platform: d.platform,
        appName: d.appName,
        appVersion: d.appVersion,
        lastSeen: d.lastSeen.toISOString(),
        capabilities: d.capabilities,
      })),
      count: devices.length,
    };
  }

  const result = await deviceManager.sendCommand(null, {
    method: name,
    params: args,
  });

  return result;
}
