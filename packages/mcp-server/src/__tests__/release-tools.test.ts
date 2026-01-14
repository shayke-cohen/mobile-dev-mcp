/**
 * Tests for Release Build Tools
 */

import { handleReleaseTool, releaseTools } from '../tools/release.js';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Release Tools', () => {
  describe('Tool Definitions', () => {
    it('should export all release tools', () => {
      expect(releaseTools).toHaveLength(5);
      
      const toolNames = releaseTools.map(t => t.name);
      expect(toolNames).toContain('get_app_version_info');
      expect(toolNames).toContain('set_app_version');
      expect(toolNames).toContain('build_release_ios');
      expect(toolNames).toContain('build_release_android');
      expect(toolNames).toContain('validate_release_build');
    });

    it('all tools should have valid input schemas', () => {
      for (const tool of releaseTools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });
  });

  describe('get_app_version_info', () => {
    it('should throw error for non-existent path', async () => {
      await expect(
        handleReleaseTool('get_app_version_info', {
          projectPath: '/non/existent/path',
        })
      ).rejects.toThrow('Project path not found');
    });

    it('should detect iOS project in demo app', async () => {
      const projectPath = path.join(__dirname, '../../../../examples/ios-swiftui-demo');
      
      if (!fs.existsSync(projectPath)) {
        console.log('Skipping: iOS demo app not found');
        return;
      }

      const result = await handleReleaseTool('get_app_version_info', {
        projectPath,
        platform: 'ios',
      }) as { ios?: { version: string; buildNumber: string | number; bundleId?: string } };

      expect(result.ios).toBeDefined();
      expect(result.ios?.version).toBeDefined();
      expect(result.ios?.buildNumber).toBeDefined();
    });

    it('should detect Android project in demo app', async () => {
      const projectPath = path.join(__dirname, '../../../../examples/android-compose-demo');
      
      if (!fs.existsSync(projectPath)) {
        console.log('Skipping: Android demo app not found');
        return;
      }

      const result = await handleReleaseTool('get_app_version_info', {
        projectPath,
        platform: 'android',
      }) as { android?: { version: string; buildNumber: number; applicationId?: string } };

      expect(result.android).toBeDefined();
      expect(result.android?.version).toBeDefined();
      expect(result.android?.buildNumber).toBeDefined();
    });

    it('should auto-detect React Native project', async () => {
      const projectPath = path.join(__dirname, '../../../../examples/react-native-demo');
      
      if (!fs.existsSync(projectPath)) {
        console.log('Skipping: React Native demo app not found');
        return;
      }

      const result = await handleReleaseTool('get_app_version_info', {
        projectPath,
        platform: 'auto',
      }) as { ios?: unknown; android?: unknown };

      // Should detect both platforms in RN project
      expect(result.ios || result.android).toBeDefined();
    });
  });

  describe('set_app_version', () => {
    const tempDir = '/tmp/release-tools-test';
    
    beforeEach(async () => {
      // Create temp directory with mock iOS project
      fs.mkdirSync(path.join(tempDir, 'ios'), { recursive: true });
      
      // Create mock Info.plist
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleIdentifier</key>
  <string>com.test.app</string>
</dict>
</plist>`;
      fs.writeFileSync(path.join(tempDir, 'ios', 'Info.plist'), plistContent);

      // Create mock Android project
      fs.mkdirSync(path.join(tempDir, 'android/app'), { recursive: true });
      const gradleContent = `android {
    defaultConfig {
        applicationId = "com.test.app"
        versionCode = 1
        versionName = "1.0.0"
    }
}`;
      fs.writeFileSync(path.join(tempDir, 'android/app/build.gradle.kts'), gradleContent);
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should set explicit version for iOS', async () => {
      const result = await handleReleaseTool('set_app_version', {
        projectPath: tempDir,
        platform: 'ios',
        version: '2.0.0',
        buildNumber: 42,
      }) as { success: boolean; newVersion: string; newBuildNumber: number };

      expect(result.success).toBe(true);
      expect(result.newVersion).toBe('2.0.0');
      expect(result.newBuildNumber).toBe(42);
    });

    it('should set explicit version for Android', async () => {
      const result = await handleReleaseTool('set_app_version', {
        projectPath: tempDir,
        platform: 'android',
        version: '2.0.0',
        buildNumber: 42,
      }) as { success: boolean; updated: { android?: { version: string; versionCode: string } } };

      expect(result.success).toBe(true);
      
      // Verify the file was updated
      const gradleContent = fs.readFileSync(
        path.join(tempDir, 'android/app/build.gradle.kts'), 
        'utf8'
      );
      expect(gradleContent).toContain('versionName = "2.0.0"');
      expect(gradleContent).toContain('versionCode = 42');
    });

    it('should increment patch version', async () => {
      const result = await handleReleaseTool('set_app_version', {
        projectPath: tempDir,
        platform: 'ios',
        increment: 'patch',
      }) as { success: boolean; newVersion: string; newBuildNumber: number };

      expect(result.success).toBe(true);
      expect(result.newVersion).toBe('1.0.1');
      expect(result.newBuildNumber).toBe(2);
    });

    it('should increment minor version', async () => {
      const result = await handleReleaseTool('set_app_version', {
        projectPath: tempDir,
        platform: 'ios',
        increment: 'minor',
      }) as { success: boolean; newVersion: string };

      expect(result.success).toBe(true);
      expect(result.newVersion).toBe('1.1.0');
    });

    it('should increment major version', async () => {
      const result = await handleReleaseTool('set_app_version', {
        projectPath: tempDir,
        platform: 'ios',
        increment: 'major',
      }) as { success: boolean; newVersion: string };

      expect(result.success).toBe(true);
      expect(result.newVersion).toBe('2.0.0');
    });

    it('should increment build number only', async () => {
      const result = await handleReleaseTool('set_app_version', {
        projectPath: tempDir,
        platform: 'ios',
        increment: 'build',
      }) as { success: boolean; newVersion?: string; newBuildNumber: number };

      expect(result.success).toBe(true);
      expect(result.newVersion).toBeUndefined();
      expect(result.newBuildNumber).toBe(2);
    });
  });

  describe('validate_release_build', () => {
    it('should throw error for non-existent file', async () => {
      await expect(
        handleReleaseTool('validate_release_build', {
          buildPath: '/non/existent/file.ipa',
        })
      ).rejects.toThrow('Build file not found');
    });

    it('should auto-detect iOS platform from .ipa extension', async () => {
      // Create mock IPA (just for extension detection test)
      const mockIpa = '/tmp/test-app.ipa';
      
      // Create minimal zip file (IPA is a zip)
      await execAsync(`mkdir -p /tmp/Payload/Test.app && touch /tmp/Payload/Test.app/Info.plist && cd /tmp && zip -r "${mockIpa}" Payload`);
      
      // Create minimal Info.plist
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleIdentifier</key>
  <string>com.test.app</string>
</dict>
</plist>`;
      fs.writeFileSync('/tmp/Payload/Test.app/Info.plist', plistContent);
      await execAsync(`cd /tmp && zip -r "${mockIpa}" Payload`);

      try {
        const result = await handleReleaseTool('validate_release_build', {
          buildPath: mockIpa,
        }) as { platform: string };

        expect(result.platform).toBe('ios');
      } finally {
        fs.rmSync(mockIpa, { force: true });
        fs.rmSync('/tmp/Payload', { recursive: true, force: true });
      }
    });

    it('should auto-detect Android platform from .aab extension', async () => {
      const mockAab = '/tmp/test-app.aab';
      
      // Create minimal file
      fs.writeFileSync(mockAab, 'mock aab content');
      
      try {
        const result = await handleReleaseTool('validate_release_build', {
          buildPath: mockAab,
        }) as { platform: string };

        expect(result.platform).toBe('android');
      } finally {
        fs.rmSync(mockAab, { force: true });
      }
    });
  });

  describe('build_release_ios', () => {
    it('should throw error for non-existent project', async () => {
      await expect(
        handleReleaseTool('build_release_ios', {
          projectPath: '/non/existent/path',
        })
      ).rejects.toThrow('Project path not found');
    });

    it('should detect missing Xcode project', async () => {
      const tempDir = '/tmp/empty-project';
      fs.mkdirSync(tempDir, { recursive: true });
      
      try {
        await expect(
          handleReleaseTool('build_release_ios', {
            projectPath: tempDir,
          })
        ).rejects.toThrow('No Xcode workspace or project found');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('build_release_android', () => {
    it('should throw error for non-existent project', async () => {
      await expect(
        handleReleaseTool('build_release_android', {
          projectPath: '/non/existent/path',
        })
      ).rejects.toThrow('Project path not found');
    });

    it('should detect missing gradlew', async () => {
      const tempDir = '/tmp/empty-android-project';
      fs.mkdirSync(tempDir, { recursive: true });
      
      try {
        await expect(
          handleReleaseTool('build_release_android', {
            projectPath: tempDir,
          })
        ).rejects.toThrow('gradlew not found');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Unknown tool handling', () => {
    it('should throw error for unknown tool', async () => {
      await expect(
        handleReleaseTool('unknown_tool', {})
      ).rejects.toThrow('Unknown release tool: unknown_tool');
    });
  });
});
