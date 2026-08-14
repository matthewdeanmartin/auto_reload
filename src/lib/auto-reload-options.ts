/** A case-insensitive message fragment or regular expression for an app-specific load error. */
export type AutoReloadErrorMatcher = string | RegExp;

/** Configuration accepted by {@link provideAutoReload}. */
export interface AutoReloadOptions {
  /** Session-storage key used by the reload-loop guard. */
  storageKey?: string;
  /** A second matching failure inside this period is shown to the user instead of reloading. */
  recoveryWindowMs?: number;
  /** Clear a previous recovery attempt after the new app has run for this long. */
  stabilizationPeriodMs?: number;
  /** Let the updating overlay paint for this long before navigating. */
  reloadDelayMs?: number;
  /** Additional error matchers for a bundler's application-specific wording. */
  additionalErrorMatchers?: readonly AutoReloadErrorMatcher[];
  /**
   * Install the package's Angular ErrorHandler. Disable this when composing the
   * recovery service into an existing application ErrorHandler.
   */
  catchAngularErrors?: boolean;
  /** Receives ordinary Angular errors when the package ErrorHandler is installed. */
  onUnhandledError?: (error: unknown) => void;
  /** Overrides `window.location.reload()`, primarily for tests or host-specific navigation. */
  reload?: () => void;
}

/** Fully resolved configuration used internally and available for advanced integrations. */
export interface ResolvedAutoReloadOptions {
  storageKey: string;
  recoveryWindowMs: number;
  stabilizationPeriodMs: number;
  reloadDelayMs: number;
  additionalErrorMatchers: readonly AutoReloadErrorMatcher[];
  catchAngularErrors: boolean;
  onUnhandledError?: (error: unknown) => void;
  reload?: () => void;
}

export const DEFAULT_AUTO_RELOAD_OPTIONS: Readonly<ResolvedAutoReloadOptions> = Object.freeze({
  storageKey: 'angular.auto-reload',
  recoveryWindowMs: 60_000,
  stabilizationPeriodMs: 30_000,
  reloadDelayMs: 400,
  additionalErrorMatchers: Object.freeze([]),
  catchAngularErrors: true,
});

export function resolveAutoReloadOptions(
  options: AutoReloadOptions = {},
): ResolvedAutoReloadOptions {
  return {
    ...DEFAULT_AUTO_RELOAD_OPTIONS,
    ...options,
    additionalErrorMatchers: [...(options.additionalErrorMatchers ?? [])],
  };
}

