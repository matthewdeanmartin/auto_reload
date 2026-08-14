# Angular Auto Reload

An Angular drop-in for the awkward moment when a static deployment replaces all
hashed JavaScript files underneath an already-open tab. The old tab requests a
lazy chunk that no longer exists; this package recognizes the browser or bundler
error, shows an updating overlay, and reloads once so the new `index.html` can
provide the current hashes.

If the new page encounters the same problem, it does **not** reload forever. A
session-scoped guard stops the loop and presents a retry button instead.

## Install

Until this package is published, install it by path from an Angular app:

```bash
npm install ../auto_reload
```

Angular 17 through 21 is supported.

## Standalone application

Add one provider at application bootstrap:

```ts
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAutoReload } from '@mimb/auto-reload';

export const appConfig: ApplicationConfig = {
  providers: [provideAutoReload()],
};
```

Mount the standalone overlay once, as the last child of the root component:

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AutoReloadOverlayComponent } from '@mimb/auto-reload';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AutoReloadOverlayComponent],
  template: `
    <router-outlet />
    <auto-reload-overlay />
  `,
})
export class AppComponent {}
```

That is the complete default integration. `provideAutoReload()` installs raw
`window.error` and `window.unhandledrejection` listeners as well as an Angular
`ErrorHandler`, so rejected dynamic imports and Angular lazy-route failures are
both covered. Do not add `provideBrowserGlobalErrorListeners()` just for this
package; its own listeners already cover those browser events.

## Existing custom ErrorHandler

An application with logging or observability in its own `ErrorHandler` should
keep that handler and compose the recovery service into it:

```ts
providers: [
  provideAutoReload({ catchAngularErrors: false }),
  { provide: ErrorHandler, useClass: MyErrorHandler },
]
```

```ts
@Injectable()
export class MyErrorHandler implements ErrorHandler {
  private readonly autoReload = inject(AutoReloadService);

  handleError(error: unknown): void {
    if (this.autoReload.recover(error)) return;
    // Existing reporting/logging behavior.
    console.error(error);
  }
}
```

The package's default handler can also pass ordinary errors to a callback:

```ts
provideAutoReload({
  onUnhandledError: (error) => myReporter.capture(error),
});
```

## Configuration

```ts
provideAutoReload({
  storageKey: 'my-app.update-recovery',
  recoveryWindowMs: 60_000,
  stabilizationPeriodMs: 30_000,
  reloadDelayMs: 400,
  additionalErrorMatchers: ['my bundler could not load asset', /bundle 404/i],
});
```

The built-in detector covers Firefox, Chromium, Safari, Vite, webpack, and
Angular wording such as `ChunkLoadError`, `Loading chunk … failed`, dynamic
import fetch failures, failed module scripts, and module MIME-type errors.

For a custom preloader or any pipeline that catches the rejection before it can
reach a global handler, call `AutoReloadService.recover(error)`. It returns
`true` when the error was recognized and recovery took responsibility for it.

## Overlay customization

Text is exposed as component inputs:

```html
<auto-reload-overlay
  updatingTitle="Applying an update…"
  failedTitle="The update needs another try"
  retryLabel="Reload"
/>
```

Theme with CSS custom properties on the component:

```css
auto-reload-overlay {
  --auto-reload-background: #101318;
  --auto-reload-color: #fff;
  --auto-reload-muted-color: #b7c0cc;
  --auto-reload-accent: #7c5cff;
  --auto-reload-border-color: #38404a;
  --auto-reload-z-index: 5000;
}
```

An application-specific action, such as opening a bug-report dialog, can be
projected into the failed state:

```html
<auto-reload-overlay>
  <button autoReloadFailedAction type="button" (click)="openReport()">
    Report this
  </button>
</auto-reload-overlay>
```

## Behavior and tradeoffs

- Recovery is intentionally conservative: one automatic reload per recovery
  window, then an explicit user retry.
- The attempt marker lives in `sessionStorage`, so unrelated tabs do not block
  each other and a new browser session starts cleanly.
- The guard is cleared only after a stabilization period. This catches partial
  deployments where the root bundle loads but the next lazy chunk still does
  not.
- The integration is inert during server-side rendering.
- A genuine transient network failure can look identical to a removed hashed
  chunk. One reload is safe; the loop guard handles a persistent outage.

## Development

```bash
npm install
npm run check
```
