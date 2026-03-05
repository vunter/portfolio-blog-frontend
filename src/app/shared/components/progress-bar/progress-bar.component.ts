import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ProgressBarService } from '../../../core/services/progress-bar.service';

@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (progressBar.visible()) {
      <div class="progress-bar" role="progressbar" [attr.aria-valuenow]="progressBar.progress()">
        <div class="progress-bar__fill" [style.width.%]="progressBar.progress()"
             [style.opacity]="progressBar.progress() >= 100 ? 0 : 1"></div>
      </div>
    }
  `,
  styles: [`
    .progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      z-index: 99999;
      pointer-events: none;
    }
    .progress-bar__fill {
      height: 100%;
      background: var(--primary-color, #3b82f6);
      box-shadow: 0 0 8px var(--primary-color, #3b82f6);
      transition: width 150ms ease-out, opacity 300ms ease;
      border-radius: 0 2px 2px 0;
    }
  `],
})
export class ProgressBarComponent {
  readonly progressBar = inject(ProgressBarService);
}
