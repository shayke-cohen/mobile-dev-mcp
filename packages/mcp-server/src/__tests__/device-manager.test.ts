/**
 * Device Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { DeviceManager } from '../connection/device-manager';
import { WebSocketServer } from '../connection/websocket-server';

describe('DeviceManager', () => {
  let wsServer: WebSocketServer;
  let deviceManager: DeviceManager;
  let serverPort: number;

  beforeEach(async () => {
    // Find available port
    serverPort = 8900 + Math.floor(Math.random() * 100);
    wsServer = new WebSocketServer({ port: serverPort });
    deviceManager = new DeviceManager(wsServer);
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    await wsServer.close();
  });

  describe('Device Connection', () => {
    it('should accept device handshake', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}`);
      
      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          // Send handshake
          client.send(JSON.stringify({
            type: 'handshake',
            platform: 'react-native',
            appName: 'TestApp',
            appVersion: '1.0.0',
            capabilities: ['state', 'network', 'logs'],
          }));
        });

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          expect(message.type).toBe('handshake_ack');
          expect(message.deviceId).toBeDefined();
          client.close();
          resolve();
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
    });

    it('should track connected devices', async () => {
      expect(deviceManager.hasConnectedDevice()).toBe(false);

      const client = new WebSocket(`ws://localhost:${serverPort}`);
      
      await new Promise<void>((resolve) => {
        client.on('open', () => {
          client.send(JSON.stringify({
            type: 'handshake',
            platform: 'ios',
            appName: 'TestApp',
            appVersion: '1.0.0',
          }));
        });

        client.on('message', () => {
          setTimeout(() => {
            expect(deviceManager.hasConnectedDevice()).toBe(true);
            expect(deviceManager.getConnectedDevices()).toHaveLength(1);
            client.close();
            resolve();
          }, 50);
        });
      });
    });

    it('should remove device on disconnect', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}`);
      
      await new Promise<void>((resolve) => {
        client.on('open', () => {
          client.send(JSON.stringify({
            type: 'handshake',
            platform: 'android',
            appName: 'TestApp',
            appVersion: '1.0.0',
          }));
        });

        client.on('message', () => {
          expect(deviceManager.hasConnectedDevice()).toBe(true);
          client.close();
          
          setTimeout(() => {
            expect(deviceManager.hasConnectedDevice()).toBe(false);
            resolve();
          }, 100);
        });
      });
    });

    it('should reject invalid handshake', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}`);
      
      await new Promise<void>((resolve) => {
        client.on('open', () => {
          // Send invalid message
          client.send(JSON.stringify({
            type: 'not_handshake',
          }));
        });

        client.on('close', (code) => {
          expect(code).toBe(4001);
          resolve();
        });
      });
    });
  });

  describe('Command Routing', () => {
    it('should send command to device and receive response', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}`);
      let deviceId: string;
      
      await new Promise<void>((resolve) => {
        client.on('open', () => {
          client.send(JSON.stringify({
            type: 'handshake',
            platform: 'react-native',
            appName: 'TestApp',
            appVersion: '1.0.0',
          }));
        });

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'handshake_ack') {
            deviceId = message.deviceId;
            
            // Now send a command
            setTimeout(async () => {
              const commandPromise = deviceManager.sendCommand(deviceId, {
                method: 'get_app_state',
                params: {},
              });

              // Wait for command to arrive
              client.once('message', (cmdData) => {
                const cmd = JSON.parse(cmdData.toString());
                expect(cmd.method).toBe('get_app_state');
                
                // Send response
                client.send(JSON.stringify({
                  id: cmd.id,
                  result: { state: 'test' },
                }));
              });

              const result = await commandPromise;
              expect(result).toEqual({ state: 'test' });
              client.close();
              resolve();
            }, 50);
          }
        });
      });
    });

    it('should timeout on no response', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}`);
      
      await new Promise<void>((resolve) => {
        client.on('open', () => {
          client.send(JSON.stringify({
            type: 'handshake',
            platform: 'react-native',
            appName: 'TestApp',
            appVersion: '1.0.0',
          }));
        });

        client.on('message', async (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'handshake_ack') {
            // Send command but don't respond
            try {
              await deviceManager.sendCommand(message.deviceId, {
                method: 'slow_command',
                params: {},
              });
              expect.fail('Should have timed out');
            } catch (error) {
              expect((error as Error).message).toContain('timeout');
            }
            
            client.close();
            resolve();
          }
        });
      });
    }, 15000);
  });

  describe('Multiple Devices', () => {
    it('should handle multiple connected devices', async () => {
      const client1 = new WebSocket(`ws://localhost:${serverPort}`);
      const client2 = new WebSocket(`ws://localhost:${serverPort}`);
      
      const connect = (client: WebSocket, platform: string): Promise<void> => {
        return new Promise((resolve) => {
          client.on('open', () => {
            client.send(JSON.stringify({
              type: 'handshake',
              platform,
              appName: 'TestApp',
              appVersion: '1.0.0',
            }));
          });

          client.on('message', () => resolve());
        });
      };

      await Promise.all([
        connect(client1, 'ios'),
        connect(client2, 'android'),
      ]);

      await new Promise(r => setTimeout(r, 100));

      expect(deviceManager.getConnectedDevices()).toHaveLength(2);
      
      const devices = deviceManager.getConnectedDevices();
      expect(devices.some(d => d.platform === 'ios')).toBe(true);
      expect(devices.some(d => d.platform === 'android')).toBe(true);

      client1.close();
      client2.close();
    });

    it('should get primary device', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}`);
      
      await new Promise<void>((resolve) => {
        client.on('open', () => {
          client.send(JSON.stringify({
            type: 'handshake',
            platform: 'react-native',
            appName: 'TestApp',
            appVersion: '1.0.0',
          }));
        });

        client.on('message', () => {
          setTimeout(() => {
            const primary = deviceManager.getPrimaryDevice();
            expect(primary).not.toBeNull();
            expect(primary?.platform).toBe('react-native');
            client.close();
            resolve();
          }, 50);
        });
      });
    });

    it('should accept web platform handshake', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}`);
      
      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          client.send(JSON.stringify({
            type: 'handshake',
            platform: 'web',
            appName: 'WebTestApp',
            appVersion: '1.0.0',
            capabilities: ['state', 'actions', 'ui', 'network', 'logs', 'tracing'],
          }));
        });

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          expect(message.type).toBe('handshake_ack');
          expect(message.deviceId).toBeDefined();
          
          setTimeout(() => {
            const devices = deviceManager.getConnectedDevices();
            const webDevice = devices.find(d => d.platform === 'web');
            expect(webDevice).toBeDefined();
            expect(webDevice?.appName).toBe('WebTestApp');
            client.close();
            resolve();
          }, 50);
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
    });
  });
});
