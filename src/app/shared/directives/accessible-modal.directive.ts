import {
  Directive,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';

/**
 * Adds the WAI-ARIA dialog contract + keyboard handling to an inline overlay element.
 *
 * Apply on the outermost overlay <div>:
 *
 *   <div appAccessibleModal
 *        ariaLabelledBy="my-modal-title"
 *        (closed)="closeModal()">
 *     ...
 *   </div>
 *
 * What it does:
 *  - role="dialog", aria-modal="true", tabindex="-1" (so the overlay can receive focus)
 *  - Escape key emits (close)
 *  - On open: stores the previously-focused element and moves focus inside the modal
 *  - On close: restores focus to the original trigger element
 *  - Tab/Shift-Tab cycles focus inside the modal (focus trap)
 */
@Directive({
  selector: '[appAccessibleModal]',
})
export class AccessibleModalDirective implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** id of the element that names the dialog (usually the heading). */
  @Input() ariaLabelledBy?: string;
  @Input() ariaLabel?: string;
  // Renamed from 'close' to avoid the @angular-eslint/no-output-native rule
  // (native DOM 'close' event on <dialog>). Consumers use (closed)="...".
  @Output() closed = new EventEmitter<void>();

  @HostBinding('attr.role') readonly role = 'dialog';
  @HostBinding('attr.aria-modal') readonly ariaModal = 'true';
  @HostBinding('attr.tabindex') readonly tabIndex = '-1';

  @HostBinding('attr.aria-labelledby')
  get hostLabelledBy() { return this.ariaLabelledBy || null; }

  @HostBinding('attr.aria-label')
  get hostAriaLabel() { return this.ariaLabel || null; }

  private previouslyFocused: HTMLElement | null = null;

  ngOnInit(): void {
    this.previouslyFocused = (document.activeElement as HTMLElement | null);
    // Defer to allow the modal's children to render before we move focus.
    setTimeout(() => this.focusFirstElement(), 0);
  }

  ngOnDestroy(): void {
    if (this.previouslyFocused && typeof this.previouslyFocused.focus === 'function') {
      try { this.previouslyFocused.focus(); } catch { /* element may have been removed */ }
    }
  }

  @HostListener('keydown.escape', ['$event'])
  onEscape(event: Event): void {
    event.stopPropagation();
    this.closed.emit();
  }

  @HostListener('keydown.tab', ['$event'])
  onTab(event: Event): void {
    this.handleTab(event, false);
  }

  @HostListener('keydown.shift.tab', ['$event'])
  onShiftTab(event: Event): void {
    this.handleTab(event, true);
  }

  private handleTab(event: Event, shift: boolean): void {
    const focusables = this.getFocusableElements();
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement;
    if (shift && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!shift && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusFirstElement(): void {
    const focusables = this.getFocusableElements();
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      this.host.nativeElement.focus();
    }
  }

  private getFocusableElements(): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(selector))
      .filter(el => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
  }
}
