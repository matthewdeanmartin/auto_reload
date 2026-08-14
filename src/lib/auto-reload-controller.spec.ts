import { describe, expect, it, vi } from 'vitest';
import { AutoReloadController, AutoReloadRuntime, AutoReloadState } from './auto-reload-controller';
import { resolveAutoReloadOptions } from './auto-reload-options';

class FakeRuntime implements AutoReloadRuntime {
  nowValue = 1_000_000;
  readonly storage = new Map<string, string>();
  reload = vi.fn();

  now(): number {
    return this.nowValue;
  }

  readSessionValue(key: string): string | null {
    return this.storage.get(key) ?? null;
  }

  writeSessionValue(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeSessionValue(key: string): void {
    this.storage.delete(key);
  }

  setTimeout(callback: () => void, delayMs: number): unknown {
    return setTimeout(callback, delayMs);
  }

  clearTimeout(handle: unknown): void {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  }
}

function setup(options = {}) {
  const runtime = new FakeRuntime();
  const states: AutoReloadState[] = [];
  const config = resolveAutoReloadOptions(options);
  const controller = new AutoReloadController(config, runtime, (state) => states.push(state));
  return { config, controller, runtime, states };
}

describe('AutoReloadController', () => {
  it('recognizes common browser and bundler chunk failures', () => {
    const { controller } = setup();
    expect(controller.isLoadError(new Error('Failed to fetch dynamically imported module: x.js'))).toBe(true);
    expect(controller.isLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(controller.isLoadError({ name: 'ChunkLoadError', message: 'Loading chunk 42 failed' })).toBe(true);
    expect(controller.isLoadError({ reason: new Error('importing a module script failed') })).toBe(true);
    expect(controller.isLoadError(new Error('module blocked because of its MIME type'))).toBe(true);
    expect(controller.isLoadError(new Error('ordinary application crash'))).toBe(false);
  });

  it('supports application-specific matchers without looping on cyclic wrappers', () => {
    const { controller } = setup({ additionalErrorMatchers: ['asset vanished', /bundle 404/i] });
    const wrapper: Record<string, unknown> = { message: 'asset vanished' };
    wrapper['reason'] = wrapper;
    expect(controller.isLoadError(wrapper)).toBe(true);
    expect(controller.isLoadError(new Error('Bundle 404 at the CDN'))).toBe(true);
  });

  it('records and reloads once after allowing the overlay to paint', () => {
    vi.useFakeTimers();
    const { config, controller, runtime, states } = setup();

    expect(controller.recover(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(states).toEqual(['updating']);
    expect(runtime.storage.has(config.storageKey)).toBe(true);
    expect(runtime.reload).not.toHaveBeenCalled();

    controller.recover(new Error('ChunkLoadError'));
    vi.advanceTimersByTime(config.reloadDelayMs);
    expect(runtime.reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('shows failure instead of entering a reload loop', () => {
    vi.useFakeTimers();
    const { config, controller, runtime, states } = setup();
    runtime.storage.set(config.storageKey, JSON.stringify({ attemptedAt: runtime.nowValue }));

    expect(controller.recover(new Error('ChunkLoadError'))).toBe(true);
    expect(states).toEqual(['failed']);
    vi.runAllTimers();
    expect(runtime.reload).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('allows a fresh recovery after the guard window expires', () => {
    vi.useFakeTimers();
    const { config, controller, runtime, states } = setup();
    runtime.storage.set(
      config.storageKey,
      JSON.stringify({ attemptedAt: runtime.nowValue - config.recoveryWindowMs - 1 }),
    );

    controller.recover(new Error('ChunkLoadError'));
    expect(states).toEqual(['updating']);
    vi.runAllTimers();
    expect(runtime.reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('clears the loop guard only after the stabilization period', () => {
    vi.useFakeTimers();
    const { config, controller, runtime } = setup();
    runtime.storage.set(config.storageKey, JSON.stringify({ attemptedAt: runtime.nowValue }));
    controller.markApplicationStableAfterDelay();

    vi.advanceTimersByTime(config.stabilizationPeriodMs - 1);
    expect(runtime.storage.has(config.storageKey)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(runtime.storage.has(config.storageKey)).toBe(false);
    vi.useRealTimers();
  });

  it('clears the guard and reloads immediately on an explicit retry', () => {
    const { config, controller, runtime, states } = setup();
    runtime.storage.set(config.storageKey, JSON.stringify({ attemptedAt: runtime.nowValue }));

    controller.retry();
    expect(runtime.storage.has(config.storageKey)).toBe(false);
    expect(states).toEqual(['updating']);
    expect(runtime.reload).toHaveBeenCalledTimes(1);
  });
});

