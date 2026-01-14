/**
 * Debug Mode Tools - Dynamic instrumentation for surgical debugging
 * 
 * These tools enable Cursor-style Debug Mode where AI can:
 * 1. Inject targeted traces at runtime
 * 2. Collect runtime evidence
 * 3. Analyze and fix bugs
 * 4. Clean up instrumentation
 */

import { DeviceManager } from '../connection/device-manager.js';

export const debugTools = [
  {
    name: 'inject_trace',
    description: `Inject a trace point at runtime for Debug Mode. This allows you to add targeted logging to specific functions without rebuilding the app.

Use this when:
- You need to debug a specific function or set of functions
- You want to see arguments and return values at runtime
- You're testing a hypothesis about a bug

The trace will capture function calls, arguments, timing, and return values.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Function name pattern. Supports wildcards (*). Examples: "CartService.*", "*.fetchUser", "UserService.calculateTotal"',
        },
        logArgs: {
          type: 'boolean',
          description: 'Whether to log function arguments (default: true)',
        },
        logReturn: {
          type: 'boolean',
          description: 'Whether to log return values (default: true)',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'remove_trace',
    description: 'Remove a specific injected trace by its ID. Use this after you\'ve collected the data you need.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The injection ID returned when the trace was created',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'clear_injected_traces',
    description: 'Clear all injected traces. Use this to clean up after a debugging session is complete.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'list_injected_traces',
    description: 'List all currently injected traces. Shows patterns and their active status.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'start_debug_session',
    description: `Start a debug session for systematic bug investigation. This is a workflow helper that:
1. Clears previous traces
2. Injects traces based on your hypotheses
3. Prepares for reproduction

Use this at the start of debugging a specific issue.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        description: {
          type: 'string',
          description: 'Description of the bug being investigated',
        },
        hypotheses: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hypotheses about what might be wrong (e.g., ["discount not applied", "wrong tax calculation"])',
        },
        tracePatterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Patterns of functions to trace (e.g., ["CartService.*", "PricingService.calculate*"])',
        },
      },
      required: ['description', 'tracePatterns'],
    },
  },
  {
    name: 'end_debug_session',
    description: 'End a debug session, clean up all injected traces, and summarize findings.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        fixed: {
          type: 'boolean',
          description: 'Whether the bug was fixed',
        },
        summary: {
          type: 'string',
          description: 'Summary of what was found/fixed',
        },
      },
    },
  },
];

export async function handleDebugTool(
  name: string,
  args: Record<string, unknown>,
  deviceManager: DeviceManager
): Promise<unknown> {
  switch (name) {
    case 'start_debug_session': {
      // Clear previous traces
      await deviceManager.sendCommand(null, {
        method: 'clear_injected_traces',
        params: {},
      });
      await deviceManager.sendCommand(null, {
        method: 'clear_traces',
        params: {},
      });

      // Inject traces for each pattern
      const patterns = args.tracePatterns as string[] || [];
      const injectedIds: string[] = [];
      
      for (const pattern of patterns) {
        const result = await deviceManager.sendCommand(null, {
          method: 'inject_trace',
          params: { pattern, logArgs: true, logReturn: true },
        }) as { id?: string };
        
        if (result?.id) {
          injectedIds.push(result.id);
        }
      }

      return {
        session: 'started',
        description: args.description,
        hypotheses: args.hypotheses || [],
        injectedTraces: injectedIds,
        nextStep: 'Please reproduce the bug now. The traces will capture function execution data.',
      };
    }

    case 'end_debug_session': {
      // Get final traces before cleanup
      const traces = await deviceManager.sendCommand(null, {
        method: 'get_traces',
        params: { limit: 50 },
      });

      // Clear all injected traces
      await deviceManager.sendCommand(null, {
        method: 'clear_injected_traces',
        params: {},
      });

      return {
        session: 'ended',
        fixed: args.fixed || false,
        summary: args.summary || 'Debug session ended',
        finalTraces: traces,
        cleanup: 'All injected traces have been removed',
      };
    }

    default:
      // Forward other commands directly to device
      return deviceManager.sendCommand(null, {
        method: name,
        params: args,
      });
  }
}
