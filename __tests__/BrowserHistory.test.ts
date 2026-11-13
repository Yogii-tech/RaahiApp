import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';
import {
  pushSubViewHistory,
  replaceSubViewHistory,
  popSubViewHistory,
  useBrowserBack,
  _resetBrowserHistoryForTests,
  _getBrowserHistoryDebugState,
} from '../src/utils/browserHistory';

interface HistoryEntry {
  state: any;
  url: string;
}

describe('BrowserHistory Manager Tests', () => {
  const originalOS = Platform.OS;
  const originalWindow = global.window;

  let historyEntries: HistoryEntry[];
  let historyIndex: number;
  let listeners: Record<string, Array<(e: any) => void>>;
  let backSpy: jest.Mock;
  let pushStateSpy: jest.Mock;
  let replaceStateSpy: jest.Mock;

  const dispatchWindowEvent = (type: string, eventObj: any = {}) => {
    const list = [...(listeners[type] || [])];
    list.forEach((fn) => fn(eventObj));
  };

  const triggerUserBrowserBack = () => {
    if (historyIndex > 0) {
      historyIndex -= 1;
      dispatchWindowEvent('popstate', { state: historyEntries[historyIndex].state });
    }
  };

  beforeEach(() => {
    jest.useFakeTimers();
    _resetBrowserHistoryForTests();

    historyEntries = [{ state: null, url: 'http://localhost/' }];
    historyIndex = 0;
    listeners = {};

    pushStateSpy = jest.fn((state: any, _title: string, url?: string) => {
      historyEntries = historyEntries.slice(0, historyIndex + 1);
      historyEntries.push({ state, url: url || 'http://localhost/' });
      historyIndex = historyEntries.length - 1;
    });

    replaceStateSpy = jest.fn((state: any, _title: string, url?: string) => {
      historyEntries[historyIndex] = {
        state,
        url: url || historyEntries[historyIndex].url,
      };
    });

    backSpy = jest.fn(() => {
      if (historyIndex > 0) {
        historyIndex -= 1;
        // Real browsers fire popstate asynchronously after history.back()
        setTimeout(() => {
          dispatchWindowEvent('popstate', { state: historyEntries[historyIndex].state });
        }, 0);
      }
    });

    Object.defineProperty(Platform, 'OS', {
      value: 'web',
      configurable: true,
    });

    (global as any).window = {
      location: { href: 'http://localhost/', pathname: '/', search: '' },
      history: {
        get state() {
          return historyEntries[historyIndex]?.state ?? null;
        },
        pushState: pushStateSpy,
        replaceState: replaceStateSpy,
        back: backSpy,
      },
      addEventListener: jest.fn((type: string, cb: (e: any) => void) => {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(cb);
      }),
      removeEventListener: jest.fn((type: string, cb: (e: any) => void) => {
        if (!listeners[type]) return;
        listeners[type] = listeners[type].filter((item) => item !== cb);
      }),
    };
  });

  afterEach(() => {
    _resetBrowserHistoryForTests();
    jest.useRealTimers();
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
    (global as any).window = originalWindow;
  });

  test('in-app popSubViewHistory does NOT trigger parent useBrowserBack handler when async popstate fires', () => {
    const parentBack = jest.fn();
    const childBack = jest.fn();

    function TestTree({ showChild }: { showChild: boolean }) {
      useBrowserBack(true, parentBack);
      useBrowserBack(showChild, childBack);
      return null;
    }

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      pushSubViewHistory('parent');
      pushSubViewHistory('child');
      renderer = ReactTestRenderer.create(React.createElement(TestTree, { showChild: true }));
    });

    expect(_getBrowserHistoryDebugState().stackLength).toBe(2);

    // User clicks in-app back on child: closes child first, then calls popSubViewHistory()
    act(() => {
      renderer.update(React.createElement(TestTree, { showChild: false }));
      popSubViewHistory();
    });

    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(_getBrowserHistoryDebugState().pendingProgrammaticPops).toBe(1);

    // Flush the asynchronous popstate produced by window.history.back()
    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(parentBack).not.toHaveBeenCalled();
    expect(childBack).not.toHaveBeenCalled();
    expect(_getBrowserHistoryDebugState().pendingProgrammaticPops).toBe(0);
    expect(_getBrowserHistoryDebugState().stackLength).toBe(1);
  });

  test('real browser back pops handlers LIFO (top handler only)', () => {
    const parentBack = jest.fn();
    const childBack = jest.fn();

    function TestTree() {
      useBrowserBack(true, parentBack);
      useBrowserBack(true, childBack);
      return null;
    }

    act(() => {
      pushSubViewHistory('parent');
      pushSubViewHistory('child');
      ReactTestRenderer.create(React.createElement(TestTree));
    });

    act(() => {
      triggerUserBrowserBack();
    });

    expect(childBack).toHaveBeenCalledTimes(1);
    expect(parentBack).not.toHaveBeenCalled();
    expect(_getBrowserHistoryDebugState().stackLength).toBe(1);

    act(() => {
      triggerUserBrowserBack();
    });

    expect(parentBack).toHaveBeenCalledTimes(1);
    expect(_getBrowserHistoryDebugState().stackLength).toBe(0);
  });

  test('replaceSubViewHistory replaces active subView without growing history stack', () => {
    act(() => {
      pushSubViewHistory('notifications');
    });
    expect(historyEntries.length).toBe(2);
    expect((global as any).window.history.state.subView).toBe('notifications');

    act(() => {
      replaceSubViewHistory('chat');
    });
    expect(historyEntries.length).toBe(2);
    expect((global as any).window.history.state.subView).toBe('chat');
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
  });

  test('popSubViewHistory called re-entrantly inside popstate handler is a safe no-op', () => {
    const handlerThatAlsoCallsPop = jest.fn(() => {
      popSubViewHistory();
    });

    function TestTree() {
      useBrowserBack(true, handlerThatAlsoCallsPop);
      return null;
    }

    act(() => {
      pushSubViewHistory('overlay');
      ReactTestRenderer.create(React.createElement(TestTree));
    });

    act(() => {
      triggerUserBrowserBack();
    });

    expect(handlerThatAlsoCallsPop).toHaveBeenCalledTimes(1);
    expect(backSpy).not.toHaveBeenCalled();
    expect(_getBrowserHistoryDebugState().isHandlingPopState).toBe(false);
    expect(_getBrowserHistoryDebugState().pendingProgrammaticPops).toBe(0);
  });
});
