import { Component, Input, ViewEncapsulation, inject } from '@angular/core';
import { AutoReloadService } from './auto-reload.service';

/** Root-mounted, standalone UI for automatic-update and recovery-failed states. */
@Component({
  selector: 'auto-reload-overlay',
  standalone: true,
  template: `
    @if (recovery.failed()) {
      <section
        class="auto-reload-overlay"
        role="alert"
        aria-live="assertive"
        aria-labelledby="auto-reload-failed-title"
      >
        <div class="auto-reload-warning" aria-hidden="true">⚠️</div>
        <h1 id="auto-reload-failed-title">{{ failedTitle }}</h1>
        <p>{{ failedMessage }}</p>
        <div class="auto-reload-actions">
          <ng-content select="[autoReloadFailedAction]" />
          <button type="button" (click)="recovery.retry()">{{ retryLabel }}</button>
        </div>
      </section>
    } @else if (recovery.updating()) {
      <section class="auto-reload-overlay" role="status" aria-live="polite">
        <div class="auto-reload-spinner" aria-hidden="true"></div>
        <h1>{{ updatingTitle }}</h1>
        <p>{{ updatingMessage }}</p>
      </section>
    }
  `,
  styleUrls: ['./auto-reload-overlay.component.css'],
  encapsulation: ViewEncapsulation.Emulated,
})
export class AutoReloadOverlayComponent {
  protected readonly recovery = inject(AutoReloadService);

  @Input() updatingTitle = 'Updating to the latest version…';
  @Input() updatingMessage = 'A new release just shipped. Reloading to catch you up.';
  @Input() failedTitle = "Couldn't finish updating";
  @Input() failedMessage =
    "A new version was released, but this tab couldn't load it. Try again in a moment.";
  @Input() retryLabel = 'Try again';
}

