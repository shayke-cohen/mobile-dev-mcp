/**
 * Babel Plugin for MCP Auto-Instrumentation
 * 
 * Automatically wraps functions with MCP tracing calls
 * Only active in development mode (__DEV__ === true)
 */

import type { PluginObj, NodePath, types as BabelTypes } from '@babel/core';
import { declare } from '@babel/helper-plugin-utils';

interface PluginOptions {
  /** Include patterns for files to instrument (glob patterns) */
  include?: string[];
  /** Exclude patterns for files to skip (glob patterns) */
  exclude?: string[];
  /** Trace all functions, not just exported ones */
  traceAll?: boolean;
  /** Trace class methods */
  traceClasses?: boolean;
  /** Trace async functions */
  traceAsync?: boolean;
  /** Trace arrow functions */
  traceArrows?: boolean;
  /** Minimum function body size (lines) to trace */
  minLines?: number;
  /** Add performance timing */
  timing?: boolean;
  /** Custom trace function name */
  traceFn?: string;
}

const DEFAULT_OPTIONS: PluginOptions = {
  include: ['**/*.tsx', '**/*.ts', '**/*.jsx', '**/*.js'],
  exclude: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/test/**', '**/tests/**'],
  traceAll: false,
  traceClasses: true,
  traceAsync: true,
  traceArrows: false, // Usually too noisy
  minLines: 3,
  timing: true,
  traceFn: 'MCPBridge.trace',
};

export default declare((api: { assertVersion: (v: number) => void; types: typeof BabelTypes }, options: PluginOptions) => {
  api.assertVersion(7);

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const t = api.types;

  // Track imported MCP bridge
  let mcpImported = false;
  let currentFileName = '';

  /**
   * Check if file should be instrumented
   */
  function shouldInstrumentFile(filename: string): boolean {
    if (!filename) return false;

    // Check exclude patterns first
    for (const pattern of opts.exclude || []) {
      if (matchGlob(filename, pattern)) {
        return false;
      }
    }

    // Then check include patterns
    for (const pattern of opts.include || []) {
      if (matchGlob(filename, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple glob matching
   */
  function matchGlob(str: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    return new RegExp(regexPattern).test(str);
  }

  /**
   * Get function name from various node types
   */
  function getFunctionName(path: NodePath<BabelTypes.Function>): string {
    const parent = path.parent;
    const node = path.node;

    // Named function declaration
    if (t.isFunctionDeclaration(node) && node.id) {
      return node.id.name;
    }

    // Method in class or object
    if (t.isClassMethod(node) || t.isObjectMethod(node)) {
      if (t.isIdentifier(node.key)) {
        return node.key.name;
      }
    }

    // Variable declaration: const foo = function() {}
    if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
      return parent.id.name;
    }

    // Assignment: foo = function() {}
    if (t.isAssignmentExpression(parent) && t.isIdentifier(parent.left)) {
      return parent.left.name;
    }

    // Object property: { foo: function() {} }
    if (t.isObjectProperty(parent) && t.isIdentifier(parent.key)) {
      return parent.key.name;
    }

    return 'anonymous';
  }

  /**
   * Get class name if function is inside a class
   */
  function getClassName(path: NodePath): string | null {
    let current: NodePath | null = path;
    while (current) {
      if (t.isClassDeclaration(current.node) && current.node.id) {
        return current.node.id.name;
      }
      if (t.isClassExpression(current.node) && current.node.id) {
        return current.node.id.name;
      }
      current = current.parentPath;
    }
    return null;
  }

  /**
   * Count lines in function body
   */
  function countBodyLines(node: BabelTypes.BlockStatement): number {
    if (!node.loc) return 0;
    return node.loc.end.line - node.loc.start.line;
  }

  /**
   * Create the MCP trace wrapper
   */
  function createTraceWrapper(
    functionName: string,
    className: string | null,
    isAsync: boolean,
    originalBody: BabelTypes.BlockStatement,
    paramsNames: string[]
  ): BabelTypes.BlockStatement {
    const fullName = className ? `${className}.${functionName}` : functionName;
    const fileRef = currentFileName.split('/').pop() || 'unknown';

    // Create trace call: MCPBridge.trace('functionName', { args, file })
    const traceCall = t.callExpression(
      t.memberExpression(t.identifier('MCPBridge'), t.identifier('trace')),
      [
        t.stringLiteral(fullName),
        t.objectExpression([
          t.objectProperty(
            t.identifier('args'),
            t.objectExpression(
              paramsNames.map(name => 
                t.objectProperty(t.identifier(name), t.identifier(name), false, true)
              )
            )
          ),
          t.objectProperty(t.identifier('file'), t.stringLiteral(fileRef)),
          ...(opts.timing ? [
            t.objectProperty(t.identifier('startTime'), t.callExpression(t.memberExpression(t.identifier('Date'), t.identifier('now')), []))
          ] : []),
        ]),
      ]
    );

    // Create try-finally with traceReturn
    if (isAsync) {
      // For async functions, wrap in try-finally and trace return
      return t.blockStatement([
        t.ifStatement(
          t.identifier('__DEV__'),
          t.blockStatement([
            t.expressionStatement(traceCall),
          ])
        ),
        t.tryStatement(
          originalBody,
          null,
          t.blockStatement([
            t.ifStatement(
              t.identifier('__DEV__'),
              t.blockStatement([
                t.expressionStatement(
                  t.callExpression(
                    t.memberExpression(t.identifier('MCPBridge'), t.identifier('traceReturn')),
                    [t.stringLiteral(fullName)]
                  )
                ),
              ])
            ),
          ])
        ),
      ]);
    }

    // For sync functions, simpler wrapper
    return t.blockStatement([
      t.ifStatement(
        t.identifier('__DEV__'),
        t.blockStatement([
          t.expressionStatement(traceCall),
        ])
      ),
      ...originalBody.body,
    ]);
  }

  /**
   * Check if function should be traced
   */
  function shouldTrace(path: NodePath<BabelTypes.Function>): boolean {
    const node = path.node;

    // Skip if already traced (has __mcp_traced marker)
    if ((node as BabelTypes.Function & { __mcp_traced?: boolean }).__mcp_traced) {
      return false;
    }

    // Skip constructors
    if (t.isClassMethod(node) && node.kind === 'constructor') {
      return false;
    }

    // Skip getters/setters
    if (t.isClassMethod(node) && (node.kind === 'get' || node.kind === 'set')) {
      return false;
    }

    // Skip arrow functions unless enabled
    if (t.isArrowFunctionExpression(node) && !opts.traceArrows) {
      return false;
    }

    // Skip if body is too small
    if (t.isBlockStatement(node.body)) {
      if (countBodyLines(node.body) < (opts.minLines || 0)) {
        return false;
      }
    }

    // Check if exported or if traceAll is enabled
    if (!opts.traceAll) {
      // Check if this is an exported function
      const parent = path.parentPath;
      if (!parent) return false;

      const isExported = 
        t.isExportDefaultDeclaration(parent.node) ||
        t.isExportNamedDeclaration(parent.node) ||
        (t.isClassMethod(node) && opts.traceClasses);

      if (!isExported) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get parameter names from function params
   */
  function getParamNames(params: BabelTypes.Function['params']): string[] {
    return params
      .map(p => {
        if (t.isIdentifier(p)) return p.name;
        if (t.isAssignmentPattern(p) && t.isIdentifier(p.left)) return p.left.name;
        if (t.isRestElement(p) && t.isIdentifier(p.argument)) return p.argument.name;
        return null;
      })
      .filter((n): n is string => n !== null);
  }

  const plugin: PluginObj = {
    name: 'babel-plugin-mcp',

    pre(state) {
      currentFileName = (state as { filename?: string }).filename || '';
      mcpImported = false;
    },

    visitor: {
      Program: {
        enter(path, state) {
          // Check if file should be instrumented
          if (!shouldInstrumentFile(state.filename || '')) {
            path.skip();
            return;
          }

          // Check if MCPBridge is already imported
          path.traverse({
            ImportDeclaration(importPath) {
              const source = importPath.node.source.value;
              if (source.includes('@mobile-dev-mcp') || source.includes('MCPBridge')) {
                mcpImported = true;
              }
            },
          });
        },

        exit(_path) {
          // Add MCPBridge import if tracing was added and not already imported
          if (!mcpImported) {
            return;
          }
        },
      },

      // Instrument function declarations
      FunctionDeclaration(path) {
        if (!shouldTrace(path)) return;

        const node = path.node;
        if (!t.isBlockStatement(node.body)) return;

        const functionName = getFunctionName(path);
        const className = getClassName(path);
        const paramNames = getParamNames(node.params);

        const newBody = createTraceWrapper(
          functionName,
          className,
          node.async,
          node.body,
          paramNames
        );

        (node as BabelTypes.FunctionDeclaration & { __mcp_traced?: boolean }).__mcp_traced = true;
        node.body = newBody;
        mcpImported = true;
      },

      // Instrument class methods
      ClassMethod(path) {
        if (!opts.traceClasses) return;
        if (!shouldTrace(path)) return;

        const node = path.node;
        if (!t.isBlockStatement(node.body)) return;

        const functionName = getFunctionName(path);
        const className = getClassName(path);
        const paramNames = getParamNames(node.params);

        const newBody = createTraceWrapper(
          functionName,
          className,
          node.async,
          node.body,
          paramNames
        );

        (node as BabelTypes.ClassMethod & { __mcp_traced?: boolean }).__mcp_traced = true;
        node.body = newBody;
        mcpImported = true;
      },

      // Instrument function expressions
      FunctionExpression(path) {
        if (!shouldTrace(path)) return;

        const node = path.node;
        if (!t.isBlockStatement(node.body)) return;

        const functionName = getFunctionName(path);
        const className = getClassName(path);
        const paramNames = getParamNames(node.params);

        const newBody = createTraceWrapper(
          functionName,
          className,
          node.async,
          node.body,
          paramNames
        );

        (node as BabelTypes.FunctionExpression & { __mcp_traced?: boolean }).__mcp_traced = true;
        node.body = newBody;
        mcpImported = true;
      },

      // Instrument arrow functions (if enabled)
      ArrowFunctionExpression(path) {
        if (!opts.traceArrows) return;
        if (!shouldTrace(path)) return;

        const node = path.node;
        
        // Convert expression body to block statement if needed
        let body: BabelTypes.BlockStatement;
        if (t.isBlockStatement(node.body)) {
          body = node.body;
        } else {
          body = t.blockStatement([t.returnStatement(node.body)]);
        }

        const functionName = getFunctionName(path);
        const className = getClassName(path);
        const paramNames = getParamNames(node.params);

        const newBody = createTraceWrapper(
          functionName,
          className,
          node.async,
          body,
          paramNames
        );

        (node as BabelTypes.ArrowFunctionExpression & { __mcp_traced?: boolean }).__mcp_traced = true;
        node.body = newBody;
        mcpImported = true;
      },
    },
  };

  return plugin;
});

// Also export helper for manual use
export function trace(name: string, fn: Function): Function {
  return function(this: unknown, ...args: unknown[]) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[MCP Trace] ${name}`, { args });
    }
    return fn.apply(this, args);
  };
}

// Type declaration for __DEV__
declare const __DEV__: boolean;
