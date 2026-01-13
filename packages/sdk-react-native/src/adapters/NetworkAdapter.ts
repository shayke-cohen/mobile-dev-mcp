/**
 * NetworkAdapter - Intercepts and records network requests
 */

import type { NetworkRequest } from '../types';

interface MockConfig {
  id: string;
  urlPattern: RegExp;
  response: {
    statusCode: number;
    body: unknown;
    headers?: Record<string, string>;
    delay?: number;
  };
}

export class NetworkAdapter {
  private requests: NetworkRequest[] = [];
  private mocks: MockConfig[] = [];
  private maxRequests = 200;
  private enabled = false;
  private originalFetch: typeof fetch | null = null;
  private originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;

  /**
   * Enable network interception
   */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.interceptFetch();
    this.interceptXHR();
  }

  /**
   * Disable network interception
   */
  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.restoreFetch();
    this.restoreXHR();
  }

  /**
   * Get captured requests
   */
  listRequests(params: { limit?: number; filter?: { url?: string; method?: string; statusCode?: number } }): Record<string, unknown> {
    const { limit = 50, filter } = params;

    let filtered = [...this.requests];

    if (filter) {
      if (filter.url) {
        const pattern = new RegExp(filter.url);
        filtered = filtered.filter(r => pattern.test(r.url));
      }
      if (filter.method) {
        filtered = filtered.filter(r => r.method === filter.method.toUpperCase());
      }
      if (filter.statusCode) {
        filtered = filtered.filter(r => r.response?.statusCode === filter.statusCode);
      }
    }

    return {
      requests: filtered.slice(-limit),
      total: this.requests.length,
      filtered: filtered.length,
    };
  }

  /**
   * Add a mock response
   */
  mockRequest(params: { urlPattern: string; mockResponse: { statusCode: number; body: unknown; headers?: Record<string, string>; delay?: number } }): Record<string, unknown> {
    const { urlPattern, mockResponse } = params;

    const mock: MockConfig = {
      id: `mock_${Date.now()}`,
      urlPattern: new RegExp(urlPattern),
      response: mockResponse,
    };

    this.mocks.push(mock);

    return {
      mockId: mock.id,
      urlPattern,
      success: true,
    };
  }

  /**
   * Clear mocks
   */
  clearMocks(params: { mockId?: string }): Record<string, unknown> {
    const { mockId } = params;

    if (mockId) {
      this.mocks = this.mocks.filter(m => m.id !== mockId);
    } else {
      this.mocks = [];
    }

    return {
      success: true,
      remainingMocks: this.mocks.length,
    };
  }

  /**
   * Intercept fetch
   */
  private interceptFetch(): void {
    this.originalFetch = global.fetch;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';
      const startTime = Date.now();

      const request: NetworkRequest = {
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url,
        method,
        headers: init?.headers as Record<string, string> || {},
        body: init?.body,
        timestamp: new Date().toISOString(),
      };

      // Check for mocks
      for (const mock of this.mocks) {
        if (mock.urlPattern.test(url)) {
          if (mock.response.delay) {
            await new Promise(r => setTimeout(r, mock.response.delay));
          }

          request.response = {
            statusCode: mock.response.statusCode,
            headers: mock.response.headers || {},
            body: mock.response.body,
            duration: Date.now() - startTime,
          };

          this.addRequest(request);

          return new Response(JSON.stringify(mock.response.body), {
            status: mock.response.statusCode,
            headers: mock.response.headers,
          });
        }
      }

      // Execute real request
      try {
        const response = await this.originalFetch!(input, init);
        const duration = Date.now() - startTime;

        // Clone response to read body
        const cloned = response.clone();
        let responseBody: unknown;
        try {
          responseBody = await cloned.json();
        } catch {
          try {
            responseBody = await cloned.text();
          } catch {
            responseBody = '<unable to read body>';
          }
        }

        request.response = {
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
          duration,
        };

        this.addRequest(request);
        return response;

      } catch (error) {
        request.response = {
          statusCode: 0,
          headers: {},
          body: { error: error instanceof Error ? error.message : 'Network error' },
          duration: Date.now() - startTime,
        };

        this.addRequest(request);
        throw error;
      }
    };
  }

  /**
   * Intercept XMLHttpRequest
   */
  private interceptXHR(): void {
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    const self = this;

    XMLHttpRequest.prototype.open = function(method: string, url: string, ...args: unknown[]) {
      (this as XMLHttpRequest & { _mcpUrl: string; _mcpMethod: string })._mcpUrl = url;
      (this as XMLHttpRequest & { _mcpUrl: string; _mcpMethod: string })._mcpMethod = method;

      this.addEventListener('loadend', function() {
        const request: NetworkRequest = {
          id: `xhr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          url,
          method,
          headers: {},
          timestamp: new Date().toISOString(),
          response: {
            statusCode: this.status,
            headers: {},
            body: this.responseText,
            duration: 0,
          },
        };

        self.addRequest(request);
      });

      return self.originalXHROpen!.apply(this, [method, url, ...args] as Parameters<typeof XMLHttpRequest.prototype.open>);
    };
  }

  private restoreFetch(): void {
    if (this.originalFetch) {
      global.fetch = this.originalFetch;
      this.originalFetch = null;
    }
  }

  private restoreXHR(): void {
    if (this.originalXHROpen) {
      XMLHttpRequest.prototype.open = this.originalXHROpen;
      this.originalXHROpen = null;
    }
  }

  private addRequest(request: NetworkRequest): void {
    this.requests.push(request);

    // Limit stored requests
    if (this.requests.length > this.maxRequests) {
      this.requests = this.requests.slice(-this.maxRequests);
    }
  }
}
