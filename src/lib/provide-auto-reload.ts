import {
  ENVIRONMENT_INITIALIZER,
  EnvironmentProviders,
  ErrorHandler,
  Injectable,
  Provider,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { AutoReloadOptions, resolveAutoReloadOptions } from './auto-reload-options';
import { AUTO_RELOAD_OPTIONS, AutoReloadService } from './auto-reload.service';

@Injectable()
export class AutoReloadErrorHandler implements ErrorHandler {
  private readonly recovery = inject(AutoReloadService);
  private readonly options = inject(AUTO_RELOAD_OPTIONS);
  private readonly fallback = new ErrorHandler();

  handleError(error: unknown): void {
    if (this.recovery.recover(error)) {
      return;
    }
    if (this.options.onUnhandledError !== undefined) {
      this.options.onUnhandledError(error);
      return;
    }
    this.fallback.handleError(error);
  }
}

/**
 * Installs deployment-error listeners, initializes the recovery guard, and by
 * default supplies an Angular ErrorHandler for lazy-route failures.
 */
export function provideAutoReload(options: AutoReloadOptions = {}): EnvironmentProviders {
  const resolved = resolveAutoReloadOptions(options);
  const providers: Array<Provider | EnvironmentProviders> = [
    { provide: AUTO_RELOAD_OPTIONS, useValue: resolved },
    AutoReloadService,
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => inject(AutoReloadService).start(),
    },
  ];

  if (resolved.catchAngularErrors) {
    providers.push({ provide: ErrorHandler, useClass: AutoReloadErrorHandler });
  }
  return makeEnvironmentProviders(providers);
}
