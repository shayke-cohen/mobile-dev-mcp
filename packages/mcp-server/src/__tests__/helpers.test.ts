/**
 * Helpers Tests
 */

import { describe, it, expect } from 'vitest';
import { generateId, safeStringify, sleep, getNestedProperty } from '../utils/helpers';

describe('Helpers', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(1000);
    });

    it('should generate string IDs', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('safeStringify', () => {
    it('should stringify simple objects', () => {
      const obj = { a: 1, b: 'test' };
      const result = safeStringify(obj);
      expect(result).toBe(JSON.stringify(obj, null, 2));
    });

    it('should handle circular references', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;
      
      const result = safeStringify(obj);
      expect(result).toContain('[Circular]');
    });

    it('should handle null and undefined', () => {
      expect(safeStringify(null)).toBe('null');
      expect(safeStringify(undefined)).toBe('undefined');
    });

    it('should handle arrays', () => {
      const arr = [1, 2, { a: 3 }];
      const result = safeStringify(arr);
      expect(result).toBe(JSON.stringify(arr, null, 2));
    });
  });

  describe('sleep', () => {
    it('should wait for specified time', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('getNestedProperty', () => {
    const obj = {
      a: {
        b: {
          c: 'value',
        },
        arr: [1, 2, 3],
      },
      simple: 42,
    };

    it('should get nested property', () => {
      expect(getNestedProperty(obj, 'a.b.c')).toBe('value');
    });

    it('should get simple property', () => {
      expect(getNestedProperty(obj, 'simple')).toBe(42);
    });

    it('should return undefined for missing property', () => {
      expect(getNestedProperty(obj, 'a.b.d')).toBeUndefined();
    });

    it('should handle array access', () => {
      expect(getNestedProperty(obj, 'a.arr')).toEqual([1, 2, 3]);
    });

    it('should return the object for empty path', () => {
      expect(getNestedProperty(obj, '')).toEqual(obj);
    });
  });
});
