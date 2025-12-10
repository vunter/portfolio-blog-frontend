import { Component, ChangeDetectionStrategy, inject, ElementRef, effect } from '@angular/core';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  dialogService = inject(ConfirmDialogService);
  private readonly elementRef = inject(ElementRef);

  constructor() {
    // F-355: Auto-focus first actionable button when dialog opens
    effect(() => {
      if (this.dialogService.visible()) {
        setTimeout(() => {
          const firstButton = this.elementRef.nativeElement.querySelector(
            '.confirm-modal__actions button'
          ) as HTMLElement | null;
          firstButton?.focus();
        });
      }
    });
  }

  // ANG20-06: Moved from @HostListener to host property
  onEscape(): void {
    if (this.dialogService.visible()) {
      this.dialogService.cancel();
    }
  }

  // F-355: Trap focus within dialog
  onTabTrap(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusable = this.elementRef.nativeElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
