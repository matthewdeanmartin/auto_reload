import '@angular/compiler';
import {
  EnvironmentInjector,
  ErrorHandler,
  Injector,
  createEnvironmentInjector,
} from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_RELOAD_WINDOW, AutoReloadService } from './auto-reload.service';
import { provideAutoReload } from './provide-auto-reload';

class FakeWindow extends EventTarget {
  private readonly session = new Map<string, string>();
  readonly location = { reload: vi.fn() };
  readonly sessionStorage = {
    getItem: (key: string) => this.session.get(key) ?? null,
    setItem: (key: string, value: string) => this.session.set(key, value),
    removeItem: (key: string) => this.session.delete(key),
  };

  setTimeout(callback: () => void, delayMs: number): number {
    return globalThis.setTimeout(callback, delayMs) as unknown as number;
  }

  clearTimeout(handle: number): void {
    globalThis.clearTimeout(handle);
  }
}

describe('Angular integration', () => {
  let parent: EnvironmentInjector;
  let injector: EnvironmentInjector;
  let browserWindow: FakeWindow;

  beforeEach(() => {
    vi.useFakeTimers();
    browserWindow = new FakeWindow();
    parent = createEnvironmentInjector([], Injector.NULL as EnvironmentInjector);
    injector = createEnvironmentInjector(
      [
        { provide: AUTO_RELOAD_WINDOW, useValue: browserWindow as unknown as Window },
        provideAutoReload({ reloadDelayMs: 25 }),
      ],
      parent,
    );
  });

  afterEach(() => {
    injector?.destroy();
    parent?.destroy();
    vi.useRealTimers();
  });

  it('starts browser listeners through the environment provider', () => {
    const event = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(event, 'reason', {
      value: new Error('Failed to fetch dynamically imported module: lazy.js'),
    });

    browserWindow.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(injector.get(AutoReloadService).updating()).toBe(true);
    vi.advanceTimersByTime(25);
    expect(browserWindow.location.reload).toHaveBeenCalledTimes(1);
  });

  it('installs an Angular ErrorHandler and leaves ordinary failures to its fallback', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    injector.get(ErrorHandler).handleError(new Error('ordinary application crash'));
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
