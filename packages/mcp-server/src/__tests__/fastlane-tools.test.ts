/**
 * Tests for Fastlane Integration Tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleFastlaneTool, fastlaneTools } from '../tools/fastlane.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Fastlane Tools', () => {
  describe('Tool Definitions', () => {
    it('should export all fastlane tools', () => {
      expect(fastlaneTools).toHaveLength(5);
      
      const toolNames = fastlaneTools.map(t => t.name);
      expect(toolNames).toContain('fastlane_init');
      expect(toolNames).toContain('fastlane_run');
      expect(toolNames).toContain('fastlane_list_lanes');
      expect(toolNames).toContain('fastlane_match');
      expect(toolNames).toContain('fastlane_check');
    });

    it('all tools should have valid input schemas', () => {
      for (const tool of fastlaneTools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });
  });

  describe('fastlane_check', () => {
    it('should return installation status', async () => {
      const result = await handleFastlaneTool('fastlane_check', {}) as { 
        installed: boolean; 
        message: string;
      };

      expect(result).toBeDefined();
      expect(typeof result.installed).toBe('boolean');
      expect(result.message).toBeDefined();

      if (result.installed) {
        expect(result).toHaveProperty('version');
        expect(result).toHaveProperty('path');
      } else {
        expect(result).toHaveProperty('installInstructions');
      }
    });
  });

  describe('fastlane_init', () => {
    const tempDir = '/tmp/fastlane-tools-test';

    beforeEach(() => {
      // Create temp directory with mock project structure
      fs.mkdirSync(path.join(tempDir, 'ios'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'android'), { recursive: true });
      
      // Create mock Xcode project indicator
      fs.mkdirSync(path.join(tempDir, 'ios', 'App.xcodeproj'), { recursive: true });
      
      // Create mock Android project indicator
      fs.writeFileSync(path.join(tempDir, 'android', 'build.gradle'), 'android {}');
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should throw error for non-existent path', async () => {
      await expect(
        handleFastlaneTool('fastlane_init', {
          projectPath: '/non/existent/path',
        })
      ).rejects.toThrow('Project path not found');
    });

    it('should auto-detect cross-platform project', async () => {
      // Skip if fastlane not installed
      const check = await handleFastlaneTool('fastlane_check', {}) as { installed: boolean };
      if (!check.installed) {
        console.log('Skipping: Fastlane not installed');
        return;
      }

      const result = await handleFastlaneTool('fastlane_init', {
        projectPath: tempDir,
      }) as { success: boolean; platform: string; fastlaneDir: string };

      expect(result.success).toBe(true);
      expect(result.platform).toBe('cross-platform');
      expect(fs.existsSync(path.join(result.fastlaneDir, 'Fastfile'))).toBe(true);
      expect(fs.existsSync(path.join(result.fastlaneDir, 'Appfile'))).toBe(true);
    });

    it('should initialize iOS-only project', async () => {
      const check = await handleFastlaneTool('fastlane_check', {}) as { installed: boolean };
      if (!check.installed) {
        console.log('Skipping: Fastlane not installed');
        return;
      }

      // Remove Android directory
      fs.rmSync(path.join(tempDir, 'android'), { recursive: true });

      const result = await handleFastlaneTool('fastlane_init', {
        projectPath: tempDir,
        platform: 'ios',
      }) as { success: boolean; platform: string };

      expect(result.success).toBe(true);
      expect(result.platform).toBe('ios');
    });

    it('should detect already initialized project', async () => {
      const check = await handleFastlaneTool('fastlane_check', {}) as { installed: boolean };
      if (!check.installed) {
        console.log('Skipping: Fastlane not installed');
        return;
      }

      // Initialize first time
      await handleFastlaneTool('fastlane_init', {
        projectPath: tempDir,
      });

      // Try to initialize again
      const result = await handleFastlaneTool('fastlane_init', {
        projectPath: tempDir,
      }) as { success: boolean; alreadyInitialized: boolean };

      expect(result.success).toBe(true);
      expect(result.alreadyInitialized).toBe(true);
    });
  });

  describe('fastlane_list_lanes', () => {
    const tempDir = '/tmp/fastlane-lanes-test';

    beforeEach(() => {
      // Create temp directory with mock fastlane setup
      fs.mkdirSync(path.join(tempDir, 'fastlane'), { recursive: true });
      
      // Create mock Fastfile
      const fastfile = `
platform :ios do
  desc "Push a new beta build to TestFlight"
  lane :beta do
    build_app
  end

  desc "Push to App Store"
  lane :release do
    build_app
    upload_to_app_store
  end
end

platform :android do
  desc "Deploy to Play Store internal"
  lane :internal do
    gradle
  end
end
`;
      fs.writeFileSync(path.join(tempDir, 'fastlane', 'Fastfile'), fastfile);
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should throw error for non-existent path', async () => {
      await expect(
        handleFastlaneTool('fastlane_list_lanes', {
          projectPath: '/non/existent/path',
        })
      ).rejects.toThrow('Project path not found');
    });

    it('should list lanes from Fastfile', async () => {
      const result = await handleFastlaneTool('fastlane_list_lanes', {
        projectPath: tempDir,
      }) as { initialized: boolean; lanes: Record<string, unknown[]>; totalLanes: number };

      expect(result.initialized).toBe(true);
      expect(result.totalLanes).toBeGreaterThan(0);
      expect(result.lanes).toBeDefined();
    });

    it('should filter lanes by platform', async () => {
      const result = await handleFastlaneTool('fastlane_list_lanes', {
        projectPath: tempDir,
        platform: 'ios',
      }) as { lanes: Record<string, unknown[]> };

      expect(result.lanes.ios).toBeDefined();
      expect(result.lanes.android).toBeUndefined();
    });

    it('should detect uninitialized project', async () => {
      const emptyDir = '/tmp/empty-project';
      fs.mkdirSync(emptyDir, { recursive: true });

      try {
        const result = await handleFastlaneTool('fastlane_list_lanes', {
          projectPath: emptyDir,
        }) as { initialized: boolean };

        expect(result.initialized).toBe(false);
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe('fastlane_run', () => {
    it('should throw error for non-existent path', async () => {
      await expect(
        handleFastlaneTool('fastlane_run', {
          projectPath: '/non/existent/path',
          lane: 'beta',
        })
      ).rejects.toThrow('Project path not found');
    });

    it('should throw error for uninitialized project', async () => {
      const emptyDir = '/tmp/empty-run-test';
      fs.mkdirSync(emptyDir, { recursive: true });

      try {
        await expect(
          handleFastlaneTool('fastlane_run', {
            projectPath: emptyDir,
            lane: 'beta',
          })
        ).rejects.toThrow('Fastlane not initialized');
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe('fastlane_match', () => {
    it('should throw error for non-existent path', async () => {
      await expect(
        handleFastlaneTool('fastlane_match', {
          projectPath: '/non/existent/path',
        })
      ).rejects.toThrow('Project path not found');
    });
  });

  describe('Unknown tool handling', () => {
    it('should throw error for unknown tool', async () => {
      await expect(
        handleFastlaneTool('unknown_tool', {})
      ).rejects.toThrow('Unknown fastlane tool: unknown_tool');
    });
  });
});
