/**
 * Fastlane Integration Tools - Phase 2 of App Store Submission
 * 
 * Tools for integrating with Fastlane for automated app deployment.
 * Requires fastlane to be installed: `brew install fastlane` or `gem install fastlane`
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// MARK: - Tool Definitions

export const fastlaneTools = [
  {
    name: 'fastlane_init',
    description: 'Initialize fastlane in a project. Creates Fastfile with common lanes for beta and release.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'cross-platform'],
          description: 'Platform to initialize (default: auto-detect)',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'fastlane_run',
    description: 'Run a fastlane lane. Use fastlane_list_lanes first to see available lanes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
          description: 'Platform (required if cross-platform project)',
        },
        lane: {
          type: 'string',
          description: 'Lane name to run (e.g., "beta", "release")',
        },
        options: {
          type: 'object',
          description: 'Lane options as key-value pairs',
          additionalProperties: true,
        },
        env: {
          type: 'object',
          description: 'Environment variables to set',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['projectPath', 'lane'],
    },
  },
  {
    name: 'fastlane_list_lanes',
    description: 'List available fastlane lanes in a project with their descriptions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android'],
          description: 'Platform to list lanes for (lists all if not specified)',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'fastlane_match',
    description: 'Sync code signing certificates and provisioning profiles using fastlane match.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the iOS project directory',
        },
        type: {
          type: 'string',
          enum: ['development', 'adhoc', 'appstore', 'enterprise'],
          description: 'Certificate type (default: appstore)',
        },
        readonly: {
          type: 'boolean',
          description: 'Only fetch existing certs, never create new ones (default: true)',
        },
        appIdentifier: {
          type: 'string',
          description: 'Bundle ID (uses project default if not specified)',
        },
        gitUrl: {
          type: 'string',
          description: 'Git URL for certificates repo (uses Matchfile if not specified)',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'fastlane_check',
    description: 'Check if fastlane is installed. Optionally install it if missing.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        install: {
          type: 'boolean',
          description: 'If true and fastlane is not installed, attempt to install it via Homebrew or gem',
        },
        method: {
          type: 'string',
          enum: ['brew', 'gem', 'auto'],
          description: 'Installation method (default: auto - tries brew first, then gem)',
        },
      },
    },
  },
];

// MARK: - Handler

export async function handleFastlaneTool(
  name: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'fastlane_init':
      return fastlaneInit(params);
    case 'fastlane_run':
      return fastlaneRun(params);
    case 'fastlane_list_lanes':
      return fastlaneListLanes(params);
    case 'fastlane_match':
      return fastlaneMatch(params);
    case 'fastlane_check':
      return fastlaneCheck(params);
    default:
      throw new Error(`Unknown fastlane tool: ${name}`);
  }
}

// MARK: - Check Fastlane Installation

async function fastlaneCheck(params: Record<string, unknown> = {}): Promise<unknown> {
  const shouldInstall = params.install as boolean || false;
  const method = (params.method as string) || 'auto';

  // First, check if already installed
  try {
    const { stdout: version } = await execAsync('fastlane --version');
    const { stdout: which } = await execAsync('which fastlane');
    
    return {
      installed: true,
      version: version.trim().split('\n').pop()?.trim() || version.trim(),
      path: which.trim(),
      message: 'Fastlane is installed and ready to use.',
    };
  } catch {
    // Not installed
  }

  // If not installed and install not requested, return instructions
  if (!shouldInstall) {
    return {
      installed: false,
      message: 'Fastlane is not installed.',
      installInstructions: {
        macOS: 'brew install fastlane',
        rubygems: 'gem install fastlane',
        docs: 'https://docs.fastlane.tools/getting-started/ios/setup/',
      },
      hint: 'Run fastlane_check with install: true to install automatically.',
    };
  }

  // Attempt installation
  return installFastlane(method);
}

async function installFastlane(method: string): Promise<unknown> {
  const installLog: string[] = [];

  // Check if Homebrew is available
  let hasHomebrew = false;
  try {
    await execAsync('which brew');
    hasHomebrew = true;
  } catch {
    installLog.push('Homebrew not found');
  }

  // Check if gem is available
  let hasGem = false;
  try {
    await execAsync('which gem');
    hasGem = true;
  } catch {
    installLog.push('RubyGems not found');
  }

  // Determine installation method
  let useMethod = method;
  if (method === 'auto') {
    if (hasHomebrew) {
      useMethod = 'brew';
    } else if (hasGem) {
      useMethod = 'gem';
    } else {
      return {
        installed: false,
        success: false,
        error: 'Neither Homebrew nor RubyGems found. Please install one of them first.',
        installLog,
        manualInstructions: {
          homebrew: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
          then: 'brew install fastlane',
        },
      };
    }
  }

  // Validate requested method is available
  if (useMethod === 'brew' && !hasHomebrew) {
    return {
      installed: false,
      success: false,
      error: 'Homebrew is not installed. Use method: "gem" or install Homebrew first.',
    };
  }
  if (useMethod === 'gem' && !hasGem) {
    return {
      installed: false,
      success: false,
      error: 'RubyGems is not installed.',
    };
  }

  // Install fastlane
  installLog.push(`Installing fastlane via ${useMethod}...`);

  try {
    if (useMethod === 'brew') {
      const { stdout, stderr } = await execAsync('brew install fastlane', {
        timeout: 300000, // 5 minutes
        maxBuffer: 10 * 1024 * 1024,
      });
      installLog.push(...stdout.split('\n').filter(l => l.trim()));
      if (stderr) installLog.push(...stderr.split('\n').filter(l => l.trim()));
    } else {
      // gem install - may need to handle permissions
      const { stdout, stderr } = await execAsync('gem install fastlane --user-install', {
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024,
      });
      installLog.push(...stdout.split('\n').filter(l => l.trim()));
      if (stderr) installLog.push(...stderr.split('\n').filter(l => l.trim()));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    installLog.push(`Installation error: ${message}`);
    
    return {
      installed: false,
      success: false,
      error: `Installation failed: ${message}`,
      method: useMethod,
      installLog: installLog.slice(-20),
      suggestion: useMethod === 'gem' 
        ? 'Try: sudo gem install fastlane' 
        : 'Check Homebrew is working: brew doctor',
    };
  }

  // Verify installation
  try {
    const { stdout: version } = await execAsync('fastlane --version');
    const { stdout: which } = await execAsync('which fastlane');
    
    return {
      installed: true,
      success: true,
      version: version.trim().split('\n').pop()?.trim() || version.trim(),
      path: which.trim(),
      method: useMethod,
      message: `Fastlane installed successfully via ${useMethod}!`,
      installLog: installLog.slice(-10),
    };
  } catch {
    // Installation succeeded but fastlane not in PATH
    return {
      installed: false,
      success: true,
      method: useMethod,
      message: 'Installation completed but fastlane is not in PATH.',
      installLog: installLog.slice(-10),
      suggestion: useMethod === 'gem'
        ? 'Add gem bin directory to PATH: export PATH="$PATH:$(ruby -e \'puts Gem.user_dir\')/bin"'
        : 'Try opening a new terminal window.',
    };
  }
}

// MARK: - Initialize Fastlane

async function fastlaneInit(params: Record<string, unknown>): Promise<unknown> {
  const projectPath = params.projectPath as string;
  let platform = params.platform as string | undefined;

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  // Check if fastlane is installed
  const check = await fastlaneCheck() as { installed: boolean };
  if (!check.installed) {
    throw new Error('Fastlane is not installed. Run `brew install fastlane` or `gem install fastlane`.');
  }

  // Auto-detect platform
  if (!platform) {
    const hasIOS = fs.existsSync(path.join(projectPath, 'ios')) || 
                   fs.readdirSync(projectPath).some(f => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'));
    const hasAndroid = fs.existsSync(path.join(projectPath, 'android')) ||
                       fs.existsSync(path.join(projectPath, 'build.gradle')) ||
                       fs.existsSync(path.join(projectPath, 'build.gradle.kts'));
    
    if (hasIOS && hasAndroid) {
      platform = 'cross-platform';
    } else if (hasIOS) {
      platform = 'ios';
    } else if (hasAndroid) {
      platform = 'android';
    } else {
      throw new Error('Could not detect platform. Please specify platform parameter.');
    }
  }

  // Determine fastlane directory
  let fastlaneDir: string;
  if (platform === 'ios') {
    fastlaneDir = fs.existsSync(path.join(projectPath, 'ios')) 
      ? path.join(projectPath, 'ios', 'fastlane')
      : path.join(projectPath, 'fastlane');
  } else if (platform === 'android') {
    fastlaneDir = fs.existsSync(path.join(projectPath, 'android'))
      ? path.join(projectPath, 'android', 'fastlane')
      : path.join(projectPath, 'fastlane');
  } else {
    // Cross-platform: create in both
    fastlaneDir = path.join(projectPath, 'fastlane');
  }

  // Check if already initialized
  if (fs.existsSync(path.join(fastlaneDir, 'Fastfile'))) {
    return {
      success: true,
      alreadyInitialized: true,
      fastlaneDir,
      message: 'Fastlane is already initialized in this project.',
    };
  }

  // Create fastlane directory
  fs.mkdirSync(fastlaneDir, { recursive: true });

  // Generate Fastfile based on platform
  const fastfile = generateFastfile(platform);
  fs.writeFileSync(path.join(fastlaneDir, 'Fastfile'), fastfile);

  // Generate Appfile
  const appfile = generateAppfile(platform, projectPath);
  fs.writeFileSync(path.join(fastlaneDir, 'Appfile'), appfile);

  return {
    success: true,
    fastlaneDir,
    platform,
    filesCreated: ['Fastfile', 'Appfile'],
    message: `Fastlane initialized for ${platform}. Edit ${fastlaneDir}/Fastfile to customize lanes.`,
    nextSteps: [
      'Review and edit Fastfile with your app-specific settings',
      'Run `fastlane_list_lanes` to see available lanes',
      'Run `fastlane_run` to execute a lane',
    ],
  };
}

function generateFastfile(platform: string): string {
  const iosLanes = `
platform :ios do
  desc "Push a new beta build to TestFlight"
  lane :beta do
    increment_build_number
    build_app(scheme: ENV["SCHEME"] || "App")
    upload_to_testflight(skip_waiting_for_build_processing: true)
  end

  desc "Push a new release to the App Store"
  lane :release do
    increment_build_number
    build_app(scheme: ENV["SCHEME"] || "App")
    upload_to_app_store(
      skip_metadata: true,
      skip_screenshots: true,
      submit_for_review: false
    )
  end

  desc "Build the app without uploading"
  lane :build do
    build_app(scheme: ENV["SCHEME"] || "App")
  end

  desc "Run tests"
  lane :test do
    run_tests(scheme: ENV["SCHEME"] || "App")
  end

  desc "Sync code signing"
  lane :certificates do
    match(type: "appstore", readonly: true)
  end
end`;

  const androidLanes = `
platform :android do
  desc "Push a new beta build to Play Store internal track"
  lane :beta do
    gradle(task: "clean bundleRelease")
    upload_to_play_store(
      track: "internal",
      release_status: "completed"
    )
  end

  desc "Push a new release to Play Store production"
  lane :release do |options|
    gradle(task: "clean bundleRelease")
    upload_to_play_store(
      track: "production",
      rollout: options[:rollout] || "1.0"
    )
  end

  desc "Build the app without uploading"
  lane :build do
    gradle(task: "clean assembleRelease")
  end

  desc "Run tests"
  lane :test do
    gradle(task: "test")
  end
end`;

  let content = `# Fastfile - Generated by Mobile Dev MCP
# Customize these lanes for your project

default_platform(:${platform === 'android' ? 'android' : 'ios'})

`;

  if (platform === 'ios' || platform === 'cross-platform') {
    content += iosLanes + '\n';
  }
  
  if (platform === 'android' || platform === 'cross-platform') {
    content += androidLanes + '\n';
  }

  return content;
}

function generateAppfile(platform: string, projectPath: string): string {
  let content = `# Appfile - Generated by Mobile Dev MCP
# Configure your app identifiers here

`;

  if (platform === 'ios' || platform === 'cross-platform') {
    content += `# iOS
# app_identifier("com.example.app")  # Bundle ID
# apple_id("your@email.com")         # Apple ID
# team_id("TEAM_ID")                 # Developer Portal Team ID
# itc_team_id("ITC_TEAM_ID")         # App Store Connect Team ID

`;
  }

  if (platform === 'android' || platform === 'cross-platform') {
    content += `# Android  
# json_key_file("path/to/play-store-credentials.json")
# package_name("com.example.app")

`;
  }

  return content;
}

// MARK: - Run Fastlane Lane

interface LaneResult {
  success: boolean;
  lane: string;
  platform?: string;
  duration: number;
  output: string[];
  error?: string;
}

async function fastlaneRun(params: Record<string, unknown>): Promise<LaneResult> {
  const projectPath = params.projectPath as string;
  const platform = params.platform as string | undefined;
  const lane = params.lane as string;
  const options = params.options as Record<string, unknown> | undefined;
  const env = params.env as Record<string, string> | undefined;

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  // Find fastlane directory
  const fastlaneDir = findFastlaneDir(projectPath, platform);
  if (!fastlaneDir) {
    throw new Error('Fastlane not initialized. Run fastlane_init first.');
  }

  // Build command
  let cmd = 'fastlane';
  if (platform) {
    cmd += ` ${platform}`;
  }
  cmd += ` ${lane}`;

  // Add options
  if (options) {
    for (const [key, value] of Object.entries(options)) {
      cmd += ` ${key}:${JSON.stringify(value)}`;
    }
  }

  const startTime = Date.now();
  const output: string[] = [];

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: path.dirname(fastlaneDir),
      maxBuffer: 50 * 1024 * 1024,
      env: {
        ...process.env,
        ...env,
      },
    });

    output.push(...stdout.split('\n'));
    if (stderr) output.push(...stderr.split('\n'));

    return {
      success: true,
      lane,
      platform,
      duration: Date.now() - startTime,
      output: output.slice(-50), // Last 50 lines
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Extract useful output from error
    if (error && typeof error === 'object' && 'stdout' in error) {
      output.push(...String((error as { stdout: string }).stdout).split('\n'));
    }
    if (error && typeof error === 'object' && 'stderr' in error) {
      output.push(...String((error as { stderr: string }).stderr).split('\n'));
    }

    return {
      success: false,
      lane,
      platform,
      duration: Date.now() - startTime,
      output: output.slice(-50),
      error: message,
    };
  }
}

// MARK: - List Lanes

interface LaneInfo {
  name: string;
  description: string;
  platform: string;
}

async function fastlaneListLanes(params: Record<string, unknown>): Promise<unknown> {
  const projectPath = params.projectPath as string;
  const platform = params.platform as string | undefined;

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  // Find fastlane directories to check
  const fastlaneDirs: string[] = [];
  
  // Check root
  if (fs.existsSync(path.join(projectPath, 'fastlane', 'Fastfile'))) {
    fastlaneDirs.push(path.join(projectPath, 'fastlane'));
  }
  // Check ios/
  if (fs.existsSync(path.join(projectPath, 'ios', 'fastlane', 'Fastfile'))) {
    fastlaneDirs.push(path.join(projectPath, 'ios', 'fastlane'));
  }
  // Check android/
  if (fs.existsSync(path.join(projectPath, 'android', 'fastlane', 'Fastfile'))) {
    fastlaneDirs.push(path.join(projectPath, 'android', 'fastlane'));
  }

  if (fastlaneDirs.length === 0) {
    return {
      initialized: false,
      message: 'Fastlane not initialized in this project. Run fastlane_init first.',
    };
  }

  const allLanes: LaneInfo[] = [];

  for (const fastlaneDir of fastlaneDirs) {
    const fastfilePath = path.join(fastlaneDir, 'Fastfile');
    const content = fs.readFileSync(fastfilePath, 'utf8');
    
    // Parse lanes from Fastfile
    const lanes = parseFastfile(content);
    allLanes.push(...lanes);
  }

  // Filter by platform if specified
  const filteredLanes = platform 
    ? allLanes.filter(l => l.platform === platform || l.platform === 'all')
    : allLanes;

  // Group by platform
  const byPlatform: Record<string, LaneInfo[]> = {};
  for (const lane of filteredLanes) {
    if (!byPlatform[lane.platform]) {
      byPlatform[lane.platform] = [];
    }
    byPlatform[lane.platform].push(lane);
  }

  return {
    initialized: true,
    lanes: byPlatform,
    totalLanes: filteredLanes.length,
    fastlaneDirs,
  };
}

function parseFastfile(content: string): LaneInfo[] {
  const lanes: LaneInfo[] = [];
  let currentPlatform = 'all';
  
  const lines = content.split('\n');
  let currentDesc = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect platform block
    const platformMatch = line.match(/^platform\s+:(\w+)\s+do/);
    if (platformMatch) {
      currentPlatform = platformMatch[1];
      continue;
    }

    // Detect end of platform block
    if (line === 'end' && currentPlatform !== 'all') {
      // Check if this ends the platform block (simple heuristic)
      const remainingContent = lines.slice(i + 1).join('\n');
      if (!remainingContent.includes('lane :')) {
        currentPlatform = 'all';
      }
    }

    // Detect description
    const descMatch = line.match(/^desc\s+["'](.+)["']/);
    if (descMatch) {
      currentDesc = descMatch[1];
      continue;
    }

    // Detect lane
    const laneMatch = line.match(/^lane\s+:(\w+)\s+do/);
    if (laneMatch) {
      lanes.push({
        name: laneMatch[1],
        description: currentDesc || 'No description',
        platform: currentPlatform,
      });
      currentDesc = '';
    }
  }

  return lanes;
}

// MARK: - Fastlane Match

async function fastlaneMatch(params: Record<string, unknown>): Promise<unknown> {
  const projectPath = params.projectPath as string;
  const type = (params.type as string) || 'appstore';
  const readonly = params.readonly !== false; // default true
  const appIdentifier = params.appIdentifier as string | undefined;
  const gitUrl = params.gitUrl as string | undefined;

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  // Find iOS project directory
  let iosPath = projectPath;
  if (fs.existsSync(path.join(projectPath, 'ios'))) {
    iosPath = path.join(projectPath, 'ios');
  }

  // Build match command
  let cmd = `fastlane match ${type}`;
  
  if (readonly) {
    cmd += ' --readonly';
  }
  
  if (appIdentifier) {
    cmd += ` --app_identifier "${appIdentifier}"`;
  }
  
  if (gitUrl) {
    cmd += ` --git_url "${gitUrl}"`;
  }

  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: iosPath,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      success: true,
      type,
      readonly,
      duration: Date.now() - startTime,
      output: stdout.split('\n').slice(-30),
      message: `Successfully synced ${type} certificates${readonly ? ' (readonly)' : ''}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for common issues
    if (message.includes('Could not find a Matchfile')) {
      return {
        success: false,
        error: 'Matchfile not found',
        help: [
          'Run `fastlane match init` to create a Matchfile',
          'Or provide gitUrl parameter for the certificates repo',
        ],
      };
    }

    throw new Error(`Match failed: ${message}`);
  }
}

// MARK: - Helpers

function findFastlaneDir(projectPath: string, platform?: string): string | null {
  // Check platform-specific first
  if (platform === 'ios') {
    const iosFastlane = path.join(projectPath, 'ios', 'fastlane');
    if (fs.existsSync(path.join(iosFastlane, 'Fastfile'))) {
      return iosFastlane;
    }
  }
  
  if (platform === 'android') {
    const androidFastlane = path.join(projectPath, 'android', 'fastlane');
    if (fs.existsSync(path.join(androidFastlane, 'Fastfile'))) {
      return androidFastlane;
    }
  }

  // Check common locations
  const locations = [
    path.join(projectPath, 'fastlane'),
    path.join(projectPath, 'ios', 'fastlane'),
    path.join(projectPath, 'android', 'fastlane'),
  ];

  for (const loc of locations) {
    if (fs.existsSync(path.join(loc, 'Fastfile'))) {
      return loc;
    }
  }

  return null;
}
