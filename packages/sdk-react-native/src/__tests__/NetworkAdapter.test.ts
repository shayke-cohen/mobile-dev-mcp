/**
 * NetworkAdapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkAdapter } from '../adapters/NetworkAdapter';

// Mock global fetch
const originalFetch = global.fetch;

describe('NetworkAdapter', () => {
  let adapter: NetworkAdapter;

  beforeEach(() => {
    adapter = new NetworkAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    adapter.disable();
    global.fetch = originalFetch;
  });

  describe('enable/disable', () => {
    it('should intercept fetch when enabled', () => {
      const originalFetchRef = global.fetch;
      adapter.enable();
      expect(global.fetch).not.toBe(originalFetchRef);
    });

    it('should restore fetch when disabled', () => {
      adapter.enable();
      adapter.disable();
      // After disable, fetch should be restored
      expect(global.fetch).toBeDefined();
    });

    it('should not double-enable', () => {
      adapter.enable();
      const interceptedFetch = global.fetch;
      adapter.enable();
      expect(global.fetch).toBe(interceptedFetch);
    });
  });

  describe('listRequests', () => {
    it('should return empty list initially', () => {
      const result = adapter.listRequests({});
      expect(result.requests).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should filter by URL pattern', () => {
      // Add some mock requests directly
      (adapter as any).requests = [
        { id: '1', url: 'https://api.example.com/users', method: 'GET', timestamp: new Date().toISOString() },
        { id: '2', url: 'https://api.example.com/products', method: 'GET', timestamp: new Date().toISOString() },
        { id: '3', url: 'https://other.com/data', method: 'GET', timestamp: new Date().toISOString() },
      ];

      const result = adapter.listRequests({
        filter: { url: 'api.example.com' },
      });

      expect(result.filtered).toBe(2);
    });

    it('should filter by method', () => {
      (adapter as any).requests = [
        { id: '1', url: 'https://api.example.com/users', method: 'GET', timestamp: new Date().toISOString() },
        { id: '2', url: 'https://api.example.com/users', method: 'POST', timestamp: new Date().toISOString() },
      ];

      const result = adapter.listRequests({
        filter: { method: 'POST' },
      });

      expect(result.filtered).toBe(1);
    });

    it('should respect limit', () => {
      (adapter as any).requests = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        url: 'https://api.example.com',
        method: 'GET',
        timestamp: new Date().toISOString(),
      }));

      const result = adapter.listRequests({ limit: 10 });
      expect((result.requests as unknown[]).length).toBe(10);
    });
  });

  describe('mockRequest', () => {
    it('should add mock configuration', () => {
      const result = adapter.mockRequest({
        urlPattern: '/api/users',
        mockResponse: {
          statusCode: 200,
          body: [{ id: 1, name: 'Test' }],
        },
      });

      expect(result.success).toBe(true);
      expect(result.mockId).toBeDefined();
    });

    it('should match URL with mock', async () => {
      adapter.enable();
      
      adapter.mockRequest({
        urlPattern: '/api/users',
        mockResponse: {
          statusCode: 200,
          body: { users: [] },
          headers: { 'Content-Type': 'application/json' },
        },
      });

      // The intercepted fetch should use the mock
      const response = await global.fetch('https://example.com/api/users');
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toEqual({ users: [] });
    });

    it('should support mock delay', () => {
      const result = adapter.mockRequest({
        urlPattern: '/api/slow',
        mockResponse: {
          statusCode: 200,
          body: {},
          delay: 1000,
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('clearMocks', () => {
    it('should clear all mocks', () => {
      adapter.mockRequest({
        urlPattern: '/api/1',
        mockResponse: { statusCode: 200, body: {} },
      });
      adapter.mockRequest({
        urlPattern: '/api/2',
        mockResponse: { statusCode: 200, body: {} },
      });

      const result = adapter.clearMocks({});
      expect(result.success).toBe(true);
      expect(result.remainingMocks).toBe(0);
    });

    it('should clear specific mock by ID', () => {
      const mock1 = adapter.mockRequest({
        urlPattern: '/api/1',
        mockResponse: { statusCode: 200, body: {} },
      });
      adapter.mockRequest({
        urlPattern: '/api/2',
        mockResponse: { statusCode: 200, body: {} },
      });

      const result = adapter.clearMocks({ mockId: mock1.mockId as string });
      expect(result.success).toBe(true);
      expect(result.remainingMocks).toBe(1);
    });
  });
});
