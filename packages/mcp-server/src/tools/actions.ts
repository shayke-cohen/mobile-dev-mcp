/**
 * Action Tools - Execute actions in the connected mobile app
 * These tools allow the AI to interact with the app, not just inspect it
 */

import { DeviceManager } from '../connection/device-manager.js';

export const actionTools = [
  {
    name: 'list_actions',
    description: 'List all registered actions available in the connected app',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'execute_action',
    description: 'Execute a registered action in the app. Use list_actions to see available actions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'Name of the action to execute (e.g., "addToCart", "navigate", "login")',
        },
        params: {
          type: 'object',
          description: 'Parameters to pass to the action',
        },
      },
      required: ['action'],
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
          description: 'Route name (e.g., "home", "products", "cart", "profile")',
        },
        params: {
          type: 'object',
          description: 'Route parameters',
        },
      },
      required: ['route'],
    },
  },
  {
    name: 'add_to_cart',
    description: 'Add a product to the shopping cart',
    inputSchema: {
      type: 'object' as const,
      properties: {
        productId: {
          type: 'string',
          description: 'ID of the product to add',
        },
        quantity: {
          type: 'number',
          description: 'Quantity to add (default: 1)',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'remove_from_cart',
    description: 'Remove a product from the shopping cart',
    inputSchema: {
      type: 'object' as const,
      properties: {
        productId: {
          type: 'string',
          description: 'ID of the product to remove',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'clear_cart',
    description: 'Clear all items from the shopping cart',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'login',
    description: 'Log in to the app (uses demo user)',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'logout',
    description: 'Log out of the app',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

export async function handleActionTool(
  name: string,
  args: Record<string, unknown>,
  deviceManager: DeviceManager
): Promise<unknown> {
  // For execute_action, unwrap the params
  if (name === 'execute_action') {
    const { action, params = {} } = args;
    const paramsObj = typeof params === 'object' && params !== null ? params as Record<string, unknown> : {};
    const result = await deviceManager.sendCommand(null, {
      method: 'execute_action',
      params: { action, ...paramsObj },
    });
    return result;
  }

  // For other actions, send directly
  const result = await deviceManager.sendCommand(null, {
    method: name,
    params: args,
  });

  return result;
}
