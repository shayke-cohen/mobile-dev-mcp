/**
 * React Hooks Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MCPBridge } from '../MCPBridge';
import { useMCPState, useMCPStates } from '../hooks/useMCPState';
import { useMCPAction, useMCPActions } from '../hooks/useMCPAction';
import { useMCPTrace } from '../hooks/useMCPTrace';

// Mock MCPBridge methods
vi.mock('../MCPBridge', () => ({
  MCPBridge: {
    exposeState: vi.fn(),
    removeState: vi.fn(),
    registerAction: vi.fn(),
    removeAction: vi.fn(),
    trace: vi.fn().mockReturnValue('trace_1'),
    traceReturn: vi.fn(),
    traceAsync: vi.fn().mockImplementation(async (_name, fn) => fn()),
    traceSync: vi.fn().mockImplementation((_name, fn) => fn()),
  },
}));

describe('useMCPState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers state on mount', () => {
    const getter = () => ({ items: [] });
    renderHook(() => useMCPState('cart', getter));

    expect(MCPBridge.exposeState).toHaveBeenCalledWith('cart', expect.any(Function));
  });

  it('removes state on unmount', () => {
    const getter = () => ({ items: [] });
    const { unmount } = renderHook(() => useMCPState('cart', getter));

    unmount();

    expect(MCPBridge.removeState).toHaveBeenCalledWith('cart');
  });

  it('updates getter when it changes', () => {
    const getter1 = () => ({ items: [] });
    const getter2 = () => ({ items: [1, 2, 3] });
    
    const { rerender } = renderHook(
      ({ getter }) => useMCPState('cart', getter),
      { initialProps: { getter: getter1 } }
    );

    rerender({ getter: getter2 });

    // Should still be registered
    expect(MCPBridge.exposeState).toHaveBeenCalled();
  });
});

describe('useMCPStates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers multiple states', () => {
    const states = {
      user: () => null,
      cart: () => [],
    };

    renderHook(() => useMCPStates(states));

    expect(MCPBridge.exposeState).toHaveBeenCalledTimes(2);
  });
});

describe('useMCPAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers action on mount', () => {
    const handler = vi.fn();
    renderHook(() => useMCPAction('testAction', handler));

    expect(MCPBridge.registerAction).toHaveBeenCalledWith('testAction', expect.any(Function));
  });

  it('removes action on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useMCPAction('testAction', handler));

    unmount();

    expect(MCPBridge.removeAction).toHaveBeenCalledWith('testAction');
  });
});

describe('useMCPActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers multiple actions', () => {
    const actions = {
      login: vi.fn(),
      logout: vi.fn(),
    };

    renderHook(() => useMCPActions(actions));

    expect(MCPBridge.registerAction).toHaveBeenCalledTimes(2);
  });
});

describe('useMCPTrace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns trace functions', () => {
    const { result } = renderHook(() => useMCPTrace());

    expect(result.current.trace).toBeDefined();
    expect(result.current.traceReturn).toBeDefined();
    expect(result.current.traceAsync).toBeDefined();
    expect(result.current.traceSync).toBeDefined();
  });

  it('trace calls MCPBridge.trace', () => {
    const { result } = renderHook(() => useMCPTrace());

    act(() => {
      result.current.trace('testFunc', { args: { x: 1 } });
    });

    expect(MCPBridge.trace).toHaveBeenCalledWith('testFunc', { args: { x: 1 } });
  });

  it('traceReturn calls MCPBridge.traceReturn', () => {
    const { result } = renderHook(() => useMCPTrace());

    act(() => {
      result.current.traceReturn('testFunc', { result: 'success' });
    });

    expect(MCPBridge.traceReturn).toHaveBeenCalledWith('testFunc', { result: 'success' }, undefined);
  });

  it('traceSync wraps synchronous function', () => {
    const { result } = renderHook(() => useMCPTrace());

    let output: number = 0;
    act(() => {
      output = result.current.traceSync('syncFunc', () => 42);
    });

    expect(output).toBe(42);
    expect(MCPBridge.traceSync).toHaveBeenCalled();
  });

  it('traceAsync wraps async function', async () => {
    const { result } = renderHook(() => useMCPTrace());

    const output = await result.current.traceAsync('asyncFunc', async () => 'result');

    expect(output).toBe('result');
    expect(MCPBridge.traceAsync).toHaveBeenCalled();
  });
});
