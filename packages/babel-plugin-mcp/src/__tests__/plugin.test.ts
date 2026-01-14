import { describe, it, expect } from 'vitest';
import * as babel from '@babel/core';
import mcpPlugin from '../index';

describe('MCP Babel Plugin', () => {
  it('should be a valid babel plugin', () => {
    expect(mcpPlugin).toBeDefined();
    expect(typeof mcpPlugin).toBe('function');
  });

  it('should accept options', () => {
    const code = `function greet(name) { return 'Hello ' + name; }`;

    // Plugin should run without errors
    const result = babel.transformSync(code, {
      plugins: [[mcpPlugin, { traceFunctions: true }]],
      filename: 'test.js',
    });

    expect(result).toBeDefined();
    expect(result?.code).toBeDefined();
  });

  it('should not modify code when traceFunctions is false', () => {
    const code = `function greet(name) { return 'Hello ' + name; }`;

    const result = babel.transformSync(code, {
      plugins: [[mcpPlugin, { traceFunctions: false }]],
      filename: 'test.js',
    });

    // Code should be essentially unchanged
    expect(result?.code).toContain('function greet');
    expect(result?.code).toContain('Hello');
  });

  it('should handle arrow functions', () => {
    const code = `const greet = (name) => 'Hello ' + name;`;

    const result = babel.transformSync(code, {
      plugins: [[mcpPlugin, { traceFunctions: true }]],
      filename: 'test.js',
    });

    expect(result).toBeDefined();
    expect(result?.code).toBeDefined();
  });
});
