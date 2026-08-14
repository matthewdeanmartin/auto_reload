import { isAutoReloadError } from './auto-reload-detector';
import { ResolvedAutoReloadOptions } from './auto-reload-options';

export type AutoReloadState = 'idle' | 'updating' | 'failed';

export interface AutoReloadRuntime {
  now(): number;
  readSessionValue(key: string): string | null;
  writeSessionValue(key: string, value: string): void;
  removeSessionValue(key: string): void;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
  reload(): void;
}

interface RecoveryAttempt {
  attemptedAt: number;
}

/** Framework-free recovery state machine; Angular integration lives in the service. */
export class AutoReloadController {
  private recoveryStarted = false;
  private reloadTimer: unknown;
  private stabilizationTimer: unknown;

  constructor(
    private readonly config: ResolvedAutoReloadOptions,
    private readonly runtime: AutoReloadRuntime,
    private readonly setState: (state: AutoReloadState) => void,
  ) {}

  isLoadError(error: unknown): boolean {
    return isAutoReloadError(error, this.config.additionalErrorMatchers);
  }

  /** Handle an error, returning true only when this controller took responsibility for it. */
  recover(error: unknown): boolean {
    if (!this.isLoadError(error)) {
      return false;
    }
    if (this.recoveryStarted) {
      return true;
    }
    this.recoveryStarted = true;

    const previousAttempt = this.readRecoveryAttempt();
    const now = this.runtime.now();
    if (
      previousAttempt !== null &&
      now - previousAttempt.attemptedAt < this.config.recoveryWindowMs
    ) {
      this.setState('failed');
      return true;
    }

    this.writeRecoveryAttempt({ attemptedAt: now });
    this.setState('updating');
    this.reloadTimer = this.runtime.setTimeout(() => this.reloadSafely(), this.config.reloadDelayMs);
    return true;
  }

  /** Clear a prior attempt only after the newly loaded app has remained healthy. */
  markApplicationStableAfterDelay(): void {
    this.stabilizationTimer = this.runtime.setTimeout(
      () => this.clearRecoveryAttempt(),
      this.config.stabilizationPeriodMs,
    );
  }

  /** User-requested retry after the loop guard stopped automatic navigation. */
  retry(): void {
    this.clearRecoveryAttempt();
    this.setState('updating');
    this.reloadSafely();
  }

  destroy(): void {
    if (this.reloadTimer !== undefined) {
      this.runtime.clearTimeout(this.reloadTimer);
    }
    if (this.stabilizationTimer !== undefined) {
      this.runtime.clearTimeout(this.stabilizationTimer);
    }
  }

  private reloadSafely(): void {
    try {
      this.runtime.reload();
    } catch {
      this.setState('failed');
    }
  }

  private readRecoveryAttempt(): RecoveryAttempt | null {
    try {
      const serialized = this.runtime.readSessionValue(this.config.storageKey);
      if (serialized === null) {
        return null;
      }
      const parsed: unknown = JSON.parse(serialized);
      if (
        isRecord(parsed) &&
        typeof parsed['attemptedAt'] === 'number' &&
        Number.isFinite(parsed['attemptedAt'])
      ) {
        return { attemptedAt: parsed['attemptedAt'] };
      }
    } catch {
      // Storage may be unavailable in hardened browser modes; recovery can still proceed.
    }
    return null;
  }

  private writeRecoveryAttempt(attempt: RecoveryAttempt): void {
    try {
      this.runtime.writeSessionValue(this.config.storageKey, JSON.stringify(attempt));
    } catch {
      // A storage failure should not turn a recoverable deployment into a blank page.
    }
  }

  private clearRecoveryAttempt(): void {
    try {
      this.runtime.removeSessionValue(this.config.storageKey);
    } catch {
      // Nothing else to do.
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

