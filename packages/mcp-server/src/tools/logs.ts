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
  // ==================== Tracing Tools ====================
  {
    name: 'get_traces',
    description: 'Get function execution traces (requires auto-instrumentation via Babel plugin for React Native, or manual tracing for native apps). Shows function calls with timing, arguments, and return values.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Filter by function name pattern (e.g., "Cart", "User.fetch")',
        },
        file: {
          type: 'string',
          description: 'Filter by source file pattern (e.g., "CartService")',
        },
        minDuration: {
          type: 'number',
          description: 'Only show traces longer than this duration (ms)',
        },
        since: {
          type: 'number',
          description: 'Only show traces from the last N milliseconds',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of traces to return (default: 100)',
        },
      },
    },
  },
  {
    name: 'get_active_traces',
    description: 'Get currently executing function traces (functions that have started but not yet returned). Useful for finding stuck or long-running operations.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'clear_traces',
    description: 'Clear all trace history. Useful to start fresh before reproducing a bug.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_slow_traces',
    description: 'Get the slowest function executions. Useful for performance analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        minDuration: {
          type: 'number',
          description: 'Minimum duration in ms (default: 100)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of traces to return (default: 20)',
        },
      },
    },
  },
  {
    name: 'get_failed_traces',
    description: 'Get function executions that threw errors. Useful for debugging exceptions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of traces to return (default: 20)',
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
  // Map tool names to SDK commands
  let method = name;
  let params = args;

  // Handle special trace tools
  if (name === 'get_slow_traces') {
    method = 'get_traces';
    params = {
      minDuration: args.minDuration || 100,
      limit: args.limit || 20,
    };
  } else if (name === 'get_failed_traces') {
    method = 'get_traces';
    // Filter for traces with errors on the SDK side
    params = {
      limit: args.limit || 20,
      hasError: true,
    };
  }

  const result = await deviceManager.sendCommand(null, {
    method,
    params,
  });

  // Post-process for get_failed_traces to filter only errored traces
  if (name === 'get_failed_traces' && result && typeof result === 'object') {
    const typedResult = result as { traces?: Array<{ error?: string }> };
    if (typedResult.traces) {
      typedResult.traces = typedResult.traces.filter(t => t.error);
    }
  }

  return result;
}
