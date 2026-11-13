import TrackingService from '../src/services/TrackingService';
import { fetchRoute, reverseGeocode } from '../src/modern_map/services/geocoding';

describe('TrackingService explicit state machine', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    TrackingService.stopTracking();
  });

  afterEach(() => {
    TrackingService.stopTracking();
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('transitions idle -> running -> idle, prevents overlapping POSTs, and aborts on stopTracking', async () => {
    const firstFetchGate: { resolve: ((val: any) => void) | null } = { resolve: null };
    let capturedSignal: AbortSignal | undefined;

    const fetchMock = jest.fn((_url: any, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise((resolve) => {
        firstFetchGate.resolve = resolve;
      });
    });
    (global as any).fetch = fetchMock;

    expect(TrackingService.getState()).toBe('idle');

    TrackingService.startTracking('rider-1', 'order-1');
    expect(TrackingService.getState()).toBe('running');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstPayload = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(firstPayload.rider_id).toBe('rider-1');
    expect(firstPayload.order_id).toBe('order-1');

    // Advance 5 seconds while first request is still in-flight: must NOT overlap
    jest.advanceTimersByTime(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Stopping aborts the in-flight request and returns to idle
    TrackingService.stopTracking();
    expect(TrackingService.getState()).toBe('idle');
    expect(capturedSignal?.aborted).toBe(true);

    // Resolve old promise cleanly so no unhandled rejections remain
    firstFetchGate.resolve?.({ ok: true });
    await Promise.resolve();

    // Starting a new session resets step and uses new rider/order IDs
    fetchMock.mockImplementation(() => Promise.resolve({ ok: true }));
    TrackingService.startTracking('rider-2', 'order-2');
    expect(TrackingService.getState()).toBe('running');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondPayload = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(secondPayload.rider_id).toBe('rider-2');
    expect(secondPayload.order_id).toBe('order-2');
    expect(secondPayload.latitude).toBeCloseTo(firstPayload.latitude, 6);
    expect(secondPayload.longitude).toBeCloseTo(firstPayload.longitude, 6);
  });
});

describe('geocoding AbortSignal support', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('fetchRoute and reverseGeocode pass AbortSignal and handle AbortError gracefully', async () => {
    const controller = new AbortController();
    const abortErr = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    const fetchMock = jest.fn(() => Promise.reject(abortErr));
    (global as any).fetch = fetchMock;

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const route = await fetchRoute([30.3165, 78.0322], [30.4599, 78.0664], controller.signal);
    expect(route).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('router.project-osrm.org'),
      expect.objectContaining({ signal: controller.signal })
    );
    expect(consoleSpy).not.toHaveBeenCalled();

    const addr = await reverseGeocode(30.3165, 78.0322, controller.signal);
    expect(addr).toBe('30.31650, 78.03220');
  });
});
