/**
 * Logging & Error Tools
 */

import { DeviceManager } from '../connection/device-manager.js';

export const logsTools = [
  {
    name: 'get_logs',
    description: 'Retrieve application logs (console.log, print, etc.)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        level: {
          type: 'string',
          enum: ['debug', 'info', 'warn', 'error'],
          description: 'Minimum log level to include',
        },
        filter: {
          type: 'string',
          description: 'Regex pattern to filter logs',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of logs to return (default: 100)',
        },
        since: {
          type: 'string',
          description: 'ISO timestamp - only logs after this time',
        },
      },
    },
  },
  {
    name: 'get_recent_errors',
    description: 'Get recent errors and exceptions with full context (stack trace, state, user actions)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of errors to return (default: 10)',
        },
        severity: {
          type: 'string',
          enum: ['error', 'warning'],
          description: 'Minimum severity level',
        },
      },
    },
  },
  {
    name: 'get_crash_reports',
    description: 'Get crash logs with full context including state at crash time',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of crash reports',
        },
      },
    },
  },
  {
    name: 'get_function_trace',
    description: 'Get execution trace of function calls (if tracing is enabled via Babel plugin)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        functionName: {
          type: 'string',
          description: 'Filter by function name (supports wildcards)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of trace entries',
        },
        includeArgs: {
          type: 'boolean',
          description: 'Include function arguments (default: true)',
        },
        includeReturns: {
          type: 'boolean',
          description: 'Include return values (default: true)',
        },
      },
    },
  },
];

export async function handleLogsTool(
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
