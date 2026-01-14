module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // MCP auto-instrumentation - enabled for development
  plugins: [
    ['@mobile-dev-mcp/babel-plugin', {
      traceAll: false,        // Only trace exported functions
      traceClasses: true,     // Trace class methods
      traceAsync: true,       // Trace async functions
      traceArrows: false,     // Skip arrow functions (usually too noisy)
      minLines: 3,            // Skip small functions
      timing: true,           // Add performance timing
      include: ['src/**/*.{js,ts,tsx}'],
      exclude: ['**/node_modules/**', '**/*.test.*', '**/mcp/**'], // Exclude MCP bridge itself
    }]
  ],
};
