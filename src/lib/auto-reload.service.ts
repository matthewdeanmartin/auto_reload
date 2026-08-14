import {
  DestroyRef,
  Injectable,
  InjectionToken,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AutoReloadController,
  AutoReloadRuntime,
  AutoReloadState,
} from './auto-reload-controller';
import {
  DEFAULT_AUTO_RELOAD_OPTIONS,
  ResolvedAutoReloadOptions,
} from './auto-reload-options';

export const AUTO_RELOAD_OPTIONS = new InjectionToken<ResolvedAutoReloadOptions>(
  'AUTO_RELOAD_OPTIONS',
  { factory: () => ({ ...DEFAULT_AUTO_RELOAD_OPTIONS }) },
);

/** Overrideable browser token; `null` during server-side rendering. */
export const AUTO_RELOAD_WINDOW = new InjectionToken<Window | null>('AUTO_RELOAD_WINDOW', {
  factory: () => (typeof window === 'undefined' ? null : window),
});

@Injectable({ providedIn: 'root' })
export class AutoReloadService {
  private readonly browserWindow = inject(AUTO_RELOAD_WINDOW);
  private readonly config = inject(AUTO_RELOAD_OPTIONS);
  private readonly destroyRef = inject(DestroyRef);
  private readonly stateSignal = signal<AutoReloadState>('idle');
  private readonly controller = new AutoReloadController(
    this.config,
    createBrowserRuntime(this.browserWindow, this.config),
    (state) => this.stateSignal.set(state),
  );
  private started = false;

  readonly state: Signal<AutoReloadState> = this.stateSignal.asReadonly();
  readonly updating = computed(() => this.stateSignal() === 'updating');
  readonly failed = computed(() => this.stateSignal() === 'failed');

  private readonly onWindowError = (event: ErrorEvent): void => {
    const error = event.error ?? event.message ?? event;
    if (this.recover(error)) {
      event.preventDefault();
    }
  };

  private readonly onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    if (this.recover(event.reason)) {
      event.preventDefault();
    }
  };

  /** Called automatically by {@link provideAutoReload}; safe to call more than once. */
  start(): void {
    if (this.started || this.browserWindow === null) {
      return;
    }
    this.started = true;
    this.browserWindow.addEventListener('error', this.onWindowError);
    this.browserWindow.addEventListener('unhandledrejection', this.onUnhandledRejection);
    this.controller.markApplicationStableAfterDelay();

    this.destroyRef.onDestroy(() => {
      this.browserWindow?.removeEventListener('error', this.onWindowError);
      this.browserWindow?.removeEventListener('unhandledrejection', this.onUnhandledRejection);
      this.controller.destroy();
    });
  }

  /** Use from an existing ErrorHandler, router hook, or custom preloading pipeline. */
  recover(error: unknown): boolean {
    return this.browserWindow !== null && this.controller.recover(error);
  }

  isLoadError(error: unknown): boolean {
    return this.controller.isLoadError(error);
  }

  retry(): void {
    if (this.browserWindow !== null) {
      this.controller.retry();
    }
  }
}

function createBrowserRuntime(
  browserWindow: Window | null,
  config: ResolvedAutoReloadOptions,
): AutoReloadRuntime {
  return {
    now: () => Date.now(),
    readSessionValue: (key) => browserWindow?.sessionStorage.getItem(key) ?? null,
    writeSessionValue: (key, value) => browserWindow?.sessionStorage.setItem(key, value),
    removeSessionValue: (key) => browserWindow?.sessionStorage.removeItem(key),
    setTimeout: (callback, delayMs) => browserWindow?.setTimeout(callback, delayMs),
    clearTimeout: (handle) => {
      if (browserWindow !== null && typeof handle === 'number') {
        browserWindow.clearTimeout(handle);
      }
    },
    reload: () => {
      if (config.reload !== undefined) {
        config.reload();
      } else {
        browserWindow?.location.reload();
      }
    },
  };
}

