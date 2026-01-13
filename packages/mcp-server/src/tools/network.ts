/**
 * Network Inspection Tools
 */

import { DeviceManager } from '../connection/device-manager.js';

export const networkTools = [
  {
    name: 'list_network_requests',
    description: 'Get recent network requests and responses captured from the app',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of requests to return (default: 50)',
        },
        filter: {
          type: 'object',
          description: 'Filter criteria',
          properties: {
            url: { type: 'string', description: 'URL pattern to match' },
            method: { type: 'string', description: 'HTTP method (GET, POST, etc.)' },
            statusCode: { type: 'number', description: 'Response status code' },
          },
        },
      },
    },
  },
  {
    name: 'replay_network_request',
    description: 'Re-execute a previously captured network request',
    inputSchema: {
      type: 'object' as const,
      properties: {
        requestId: {
          type: 'string',
          description: 'ID of the request to replay',
        },
        modifications: {
          type: 'object',
          description: 'Optional modifications to the request',
          properties: {
            headers: { type: 'object' },
            body: { type: 'object' },
          },
        },
      },
      required: ['requestId'],
    },
  },
  {
    name: 'mock_network_request',
    description: 'Intercept and mock specific network requests',
    inputSchema: {
      type: 'object' as const,
      properties: {
        urlPattern: {
          type: 'string',
          description: 'URL pattern to intercept (regex supported)',
        },
        mockResponse: {
          type: 'object',
          description: 'Mock response to return',
          properties: {
            statusCode: { type: 'number' },
            body: { type: 'object' },
            headers: { type: 'object' },
            delay: { type: 'number', description: 'Response delay in ms' },
          },
          required: ['statusCode', 'body'],
        },
      },
      required: ['urlPattern', 'mockResponse'],
    },
  },
  {
    name: 'clear_network_mocks',
    description: 'Remove network mocks',
    inputSchema: {
      type: 'object' as const,
      properties: {
        mockId: {
          type: 'string',
          description: 'Specific mock ID to remove. Leave empty to clear all.',
        },
      },
    },
  },
];

export async function handleNetworkTool(
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
