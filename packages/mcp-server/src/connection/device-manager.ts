/**
 * Device Manager - handles mobile app connections
 */

import { WebSocket } from 'ws';
import { WebSocketServer } from './websocket-server.js';
import { generateId } from '../utils/helpers.js';

export interface Device {
  id: string;
  platform: 'ios' | 'android' | 'react-native' | 'macos' | 'flutter' | 'web';
  appName: string;
  appVersion: string;
  connection: WebSocket;
  lastSeen: Date;
  capabilities: string[];
}

export interface MCPCommand {
  method: string;
  params?: Record<string, unknown>;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class DeviceManager {
  private devices: Map<string, Device> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private eventHandlers: Map<string, (event: unknown) => void> = new Map();

  constructor(private wsServer: WebSocketServer) {
    this.wsServer.on('connection', this.handleConnection.bind(this));
  }

  private handleConnection(ws: WebSocket): void {
    // Wait for handshake message
    const handshakeTimeout = setTimeout(() => {
      console.error('[DeviceManager] Handshake timeout, closing connection');
      ws.close(4000, 'Handshake timeout');
    }, 5000);

    ws.once('message', (data) => {
      clearTimeout(handshakeTimeout);

      try {
        const message = JSON.parse(data.toString());

        if (message.type !== 'handshake') {
          console.error('[DeviceManager] Expected handshake, got:', message.type);
          ws.close(4001, 'Expected handshake');
          return;
        }

        const device: Device = {
          id: message.deviceId || generateId(),
          platform: message.platform,
          appName: message.appName,
          appVersion: message.appVersion,
          connection: ws,
          lastSeen: new Date(),
          capabilities: message.capabilities || [],
        };

        this.devices.set(device.id, device);
        console.error(`[DeviceManager] Device connected: ${device.platform} - ${device.appName} (${device.id})`);

        // Send acknowledgment
        ws.send(JSON.stringify({
          type: 'handshake_ack',
          deviceId: device.id,
          serverVersion: '0.1.0',
        }));

        // Setup message handler
        ws.on('message', (data) => this.handleDeviceMessage(device, data));

        // Handle disconnect
        ws.on('close', () => {
          this.devices.delete(device.id);
          console.error(`[DeviceManager] Device disconnected: ${device.id}`);
        });

        ws.on('error', (error) => {
          console.error(`[DeviceManager] Device error (${device.id}):`, error);
        });

      } catch (error) {
        console.error('[DeviceManager] Failed to parse handshake:', error);
        ws.close(4002, 'Invalid handshake');
      }
    });
  }

  private handleDeviceMessage(device: Device, data: unknown): void {
    try {
      const message = JSON.parse(data?.toString() || '');
      device.lastSeen = new Date();

      // Handle response to pending request
      if (message.id && this.pendingRequests.has(message.id)) {
        const pending = this.pendingRequests.get(message.id)!;
        this.pendingRequests.delete(message.id);
        clearTimeout(pending.timeout);

        if (message.error) {
          pending.reject(new Error(message.error.message || 'Unknown error'));
        } else {
          pending.resolve(message.result);
        }
        return;
      }

      // Handle push events from app
      if (message.method) {
        const handler = this.eventHandlers.get(message.method);
        if (handler) {
          handler({ device, params: message.params });
        }
      }

    } catch (error) {
      console.error('[DeviceManager] Failed to parse message:', error);
    }
  }

  /**
   * Send command to a device and wait for response
   */
  async sendCommand(deviceId: string | null, command: MCPCommand): Promise<unknown> {
    const device = deviceId
      ? this.devices.get(deviceId)
      : this.getPrimaryDevice();

    if (!device) {
      throw new Error('No device connected. Please ensure your app is running with the MCP SDK.');
    }

    return new Promise((resolve, reject) => {
      const requestId = generateId();

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout (10s)'));
      }, 10000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      device.connection.send(JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        method: command.method,
        params: command.params,
      }));
    });
  }

  /**
   * Register handler for push events from apps
   */
  onEvent(eventName: string, handler: (event: unknown) => void): void {
    this.eventHandlers.set(eventName, handler);
  }

  /**
   * Get all connected devices
   */
  getConnectedDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get primary device (first connected, or most recently active)
   */
  getPrimaryDevice(): Device | null {
    if (this.devices.size === 0) return null;

    // Return most recently active device
    return Array.from(this.devices.values())
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())[0];
  }

  /**
   * Get specific device by ID
   */
  getDevice(deviceId: string): Device | null {
    return this.devices.get(deviceId) || null;
  }

  /**
   * Check if any device is connected
   */
  hasConnectedDevice(): boolean {
    return this.devices.size > 0;
  }
}
