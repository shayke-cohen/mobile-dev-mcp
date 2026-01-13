/**
 * Simulator Tools Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as child_process from 'child_process';
import { handleSimulatorTool } from '../tools/simulator';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(() => ({
    unref: vi.fn(),
  })),
}));

vi.mock('util', () => ({
  promisify: (fn: Function) => {
    return async (...args: unknown[]) => {
      return new Promise((resolve, reject) => {
        fn(...args, (error: Error | null, stdout: string, stderr: string) => {
          if (error) reject(error);
          else resolve({ stdout, stderr });
        });
      });
    };
  },
}));

describe('Simulator Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list_simulators', () => {
    it('should list iOS simulators', async () => {
      const mockDevices = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            { name: 'iPhone 15', udid: 'test-udid-1', state: 'Booted' },
            { name: 'iPhone 15 Pro', udid: 'test-udid-2', state: 'Shutdown' },
          ],
        },
      };

      (child_process.exec as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (cmd: string, callback: Function) => {
          if (cmd.includes('simctl list')) {
            callback(null, JSON.stringify(mockDevices), '');
          } else {
            callback(null, '', '');
          }
        }
      );

      const result = await handleSimulatorTool('list_simulators', { platform: 'ios' });
      
      expect(result).toHaveProperty('devices');
      expect((result as { devices: unknown[] }).devices).toHaveLength(2);
    });

    it('should filter by state', async () => {
      const mockDevices = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            { name: 'iPhone 15', udid: 'test-udid-1', state: 'Booted' },
            { name: 'iPhone 15 Pro', udid: 'test-udid-2', state: 'Shutdown' },
          ],
        },
      };

      (child_process.exec as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (cmd: string, callback: Function) => {
          callback(null, JSON.stringify(mockDevices), '');
        }
      );

      const result = await handleSimulatorTool('list_simulators', { 
        platform: 'ios',
        state: 'booted',
      });
      
      const devices = (result as { devices: unknown[] }).devices;
      expect(devices).toHaveLength(1);
      expect((devices[0] as { state: string }).state).toBe('booted');
    });
  });

  describe('boot_simulator', () => {
    it('should boot iOS simulator', async () => {
      (child_process.exec as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (cmd: string, callback: Function) => {
          callback(null, '', '');
        }
      );

      const result = await handleSimulatorTool('boot_simulator', {
        platform: 'ios',
        deviceId: 'test-udid',
      });

      expect(result).toHaveProperty('success', true);
      expect(child_process.exec).toHaveBeenCalledWith(
        expect.stringContaining('simctl boot'),
        expect.anything()
      );
    });

    it('should handle already booted simulator', async () => {
      (child_process.exec as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (cmd: string, callback: Function) => {
          if (cmd.includes('simctl boot')) {
            callback(new Error('Unable to boot device in current state: Booted'), '', '');
          } else {
            callback(null, '', '');
          }
        }
      );

      const result = await handleSimulatorTool('boot_simulator', {
        platform: 'ios',
        deviceId: 'test-udid',
      });

      expect(result).toHaveProperty('success', true);
      expect((result as { message: string }).message).toContain('already booted');
    });
  });

  describe('install_app', () => {
    it('should throw error for missing app path', async () => {
      await expect(
        handleSimulatorTool('install_app', {
          platform: 'ios',
          appPath: '/nonexistent/path.app',
        })
      ).rejects.toThrow('App not found');
    });
  });

  describe('open_url', () => {
    it('should open URL on iOS simulator', async () => {
      const mockDevices = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            { name: 'iPhone 15', udid: 'booted-device', state: 'Booted' },
          ],
        },
      };

      (child_process.exec as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (cmd: string, callback: Function) => {
          if (cmd.includes('simctl list')) {
            callback(null, JSON.stringify(mockDevices), '');
          } else {
            callback(null, '', '');
          }
        }
      );

      const result = await handleSimulatorTool('open_url', {
        platform: 'ios',
        url: 'myapp://test',
      });

      expect(result).toHaveProperty('success', true);
      expect(child_process.exec).toHaveBeenCalledWith(
        expect.stringContaining('openurl'),
        expect.anything()
      );
    });
  });

  describe('set_location', () => {
    it('should set location on iOS simulator', async () => {
      const mockDevices = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            { name: 'iPhone 15', udid: 'booted-device', state: 'Booted' },
          ],
        },
      };

      (child_process.exec as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (cmd: string, callback: Function) => {
          if (cmd.includes('simctl list')) {
            callback(null, JSON.stringify(mockDevices), '');
          } else {
            callback(null, '', '');
          }
        }
      );

      const result = await handleSimulatorTool('set_location', {
        platform: 'ios',
        latitude: 37.7749,
        longitude: -122.4194,
      });

      expect(result).toHaveProperty('success', true);
      expect(child_process.exec).toHaveBeenCalledWith(
        expect.stringContaining('location'),
        expect.anything()
      );
    });
  });
});
