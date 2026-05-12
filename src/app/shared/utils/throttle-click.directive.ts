import { Directive, EventEmitter, HostListener, Input, OnDestroy, Output } from '@angular/core';
import { Subject, throttleTime } from 'rxjs';
import { Subscription } from 'rxjs';

/**
 * Q6.4: Prevents duplicate form submissions and rapid double-clicks.
 *
 * Usage:
 *   <button (throttleClick)="onSubmit()" [throttleMs]="1000">Save</button>
 *
 * The first click fires immediately; subsequent clicks within the throttle
 * window are silently dropped.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[throttleClick]',
})
export class ThrottleClickDirective implements OnDestroy {
  @Input() throttleMs = 1000;
  @Output() throttleClick = new EventEmitter<MouseEvent>();

  private clicks$ = new Subject<MouseEvent>();
  private subscription: Subscription;

  constructor() {
    this.subscription = this.clicks$.pipe(
      throttleTime(this.throttleMs, undefined, { leading: true, trailing: false }),
    ).subscribe(event => this.throttleClick.emit(event));
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.clicks$.next(event);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
