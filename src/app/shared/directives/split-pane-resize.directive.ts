import { Directive, ElementRef, inject, output, DestroyRef, signal } from '@angular/core';

@Directive({
  selector: '[appSplitPaneResize]',
  exportAs: 'splitPane',
})
export class SplitPaneResizeDirective {
  private readonly el = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly leftFlex = signal('1');
  readonly rightFlex = signal('1');

  private resizing = false;
  private rafPending = false;
  private cleanup: (() => void) | null = null;

  readonly resized = output<{ left: string; right: string }>();

  constructor() {
    this.destroyRef.onDestroy(() => this.cleanup?.());
  }

  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    this.resizing = true;
    const onMove = (e: MouseEvent) => this.onResizeMove(e.clientX);
    const onUp = () => {
      this.resizing = false;
      this.cleanup = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    this.cleanup = onUp;
  }

  onResizeTouchStart(event: TouchEvent): void {
    event.preventDefault();
    this.resizing = true;
    const onMove = (e: TouchEvent) => this.onResizeMove(e.touches[0].clientX);
    const onUp = () => {
      this.resizing = false;
      this.cleanup = null;
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
    this.cleanup = onUp;
  }

  reset(): void {
    this.leftFlex.set('1');
    this.rightFlex.set('1');
  }

  private onResizeMove(clientX: number): void {
    if (!this.resizing) return;
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      if (!this.resizing) return;
      const rect = this.el.nativeElement.getBoundingClientRect();
      const total = rect.width;
      const offsetX = clientX - rect.left;
      const pct = Math.max(20, Math.min(80, (offsetX / total) * 100));
      this.leftFlex.set(`${pct}`);
      this.rightFlex.set(`${100 - pct}`);
      this.resized.emit({ left: `${pct}`, right: `${100 - pct}` });
    });
  }
}
