/**
 * UI & Component Inspection Tools
 */

import { DeviceManager } from '../connection/device-manager.js';

export const uiTools = [
  {
    name: 'get_component_tree',
    description: 'Get React/SwiftUI/Compose component hierarchy with props and state',
    inputSchema: {
      type: 'object' as const,
      properties: {
        rootComponent: {
          type: 'string',
          description: 'Name of root component to start from',
        },
        includeProps: {
          type: 'boolean',
          description: 'Include component props (default: true)',
        },
        includeState: {
          type: 'boolean',
          description: 'Include component state (default: true)',
        },
        depth: {
          type: 'number',
          description: 'Maximum depth to traverse (default: 10)',
        },
      },
    },
  },
  {
    name: 'capture_screenshot',
    description: 'Capture current screen as base64 image',
    inputSchema: {
      type: 'object' as const,
      properties: {
        label: {
          type: 'string',
          description: 'Label for the screenshot (for tracking)',
        },
        compareWithBaseline: {
          type: 'boolean',
          description: 'Compare with saved baseline (visual regression)',
        },
      },
    },
  },
  {
    name: 'inspect_element',
    description: 'Get detailed info about UI element at specific coordinates',
    inputSchema: {
      type: 'object' as const,
      properties: {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'get_layout_tree',
    description: 'Get view hierarchy with layout/bounds information',
    inputSchema: {
      type: 'object' as const,
      properties: {
        includeHidden: {
          type: 'boolean',
          description: 'Include hidden views (default: false)',
        },
      },
    },
  },
  {
    name: 'find_element',
    description: 'Find UI elements by testId, type, or text content',
    inputSchema: {
      type: 'object' as const,
      properties: {
        testId: {
          type: 'string',
          description: 'Test ID to search for',
        },
        type: {
          type: 'string',
          description: 'Component type to search for (e.g., Button, Text)',
        },
        text: {
          type: 'string',
          description: 'Text content to search for',
        },
      },
    },
  },
  {
    name: 'get_element_text',
    description: 'Get the text content of an element by testId',
    inputSchema: {
      type: 'object' as const,
      properties: {
        testId: {
          type: 'string',
          description: 'Test ID of the element',
        },
      },
      required: ['testId'],
    },
  },
  {
    name: 'simulate_interaction',
    description: 'Simulate tap, swipe, or text input on the app',
    inputSchema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['tap', 'longPress', 'swipe', 'input'],
          description: 'Type of interaction',
        },
        target: {
          type: 'object',
          description: 'Target element or coordinates',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            componentId: { type: 'string' },
            testId: { type: 'string' },
          },
        },
        value: {
          type: 'string',
          description: 'Text value for input type',
        },
        direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          description: 'Swipe direction',
        },
      },
      required: ['type', 'target'],
    },
  },
  {
    name: 'navigate_to',
    description: 'Navigate to a specific screen/route in the app',
    inputSchema: {
      type: 'object' as const,
      properties: {
        route: {
          type: 'string',
          description: 'Route name or path',
        },
        params: {
          type: 'object',
          description: 'Route parameters',
        },
      },
      required: ['route'],
    },
  },
];

export async function handleUiTool(
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
