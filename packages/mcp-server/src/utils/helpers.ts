/**
 * Utility helpers
 */

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Safely stringify objects for logging
 */
export function safeStringify(obj: unknown, maxLength = 1000): string {
  try {
    // Handle circular references
    const seen = new WeakSet();
    const str = JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    }, 2);
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + '... (truncated)';
    }
    return str;
  } catch {
    return String(obj);
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get nested property from object using dot notation
 */
export function getNestedProperty(obj: unknown, path: string): unknown {
  // Return entire object for empty path
  if (!path) {
    return obj;
  }
  
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
