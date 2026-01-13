/**
 * State & Data Inspection Tools
 */

import { DeviceManager } from '../connection/device-manager.js';

export const stateTools = [
  {
    name: 'get_app_state',
    description: 'Retrieve current application state (Redux/Zustand/ViewModel). Use this to inspect the current state of the mobile app.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Dot notation path to specific state (e.g., "user.profile"). Leave empty for full state.',
        },
        deep: {
          type: 'boolean',
          description: 'Include deeply nested objects (default: true)',
        },
      },
    },
  },
  {
    name: 'query_storage',
    description: 'Query AsyncStorage (React Native), UserDefaults (iOS), or SharedPreferences (Android)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        key: {
          type: 'string',
          description: 'Specific key to retrieve. Leave empty for all keys.',
        },
        pattern: {
          type: 'string',
          description: 'Regex pattern to filter keys',
        },
      },
    },
  },
  {
    name: 'query_database',
    description: 'Execute SQL query on local SQLite/Realm database',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'SQL query to execute (SELECT only for safety)',
        },
        database: {
          type: 'string',
          description: 'Database name if multiple databases exist',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_navigation_state',
    description: 'Get current navigation stack and route information',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

export async function handleStateTool(
  name: string,
  args: Record<string, unknown>,
  deviceManager: DeviceManager
): Promise<unknown> {
  const result = await deviceManager.sendCommand(null, {
    method: name,
    params: args,
  });

  return result;
}
