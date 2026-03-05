import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ProgressBarService {
  readonly visible = signal(false);
  readonly progress = signal(0);
  private pendingRequests = 0;
  private animationId: number | null = null;
  private completeTimeout: ReturnType<typeof setTimeout> | null = null;

  start(): void {
    this.pendingRequests++;
    if (this.pendingRequests === 1) {
      if (this.completeTimeout) {
        clearTimeout(this.completeTimeout);
        this.completeTimeout = null;
      }
      this.progress.set(0);
      this.visible.set(true);
      this.animateToTarget(70, 300);
    }
  }

  complete(): void {
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    if (this.pendingRequests === 0) {
      this.cancelAnimation();
      this.progress.set(100);
      this.completeTimeout = setTimeout(() => {
        this.visible.set(false);
        this.progress.set(0);
        this.completeTimeout = null;
      }, 300);
    }
  }

  private animateToTarget(target: number, duration: number): void {
    this.cancelAnimation();
    const start = this.progress();
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const ratio = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - ratio, 3);
      this.progress.set(start + (target - start) * eased);

      if (ratio < 1) {
        this.animationId = requestAnimationFrame(tick);
      } else if (target < 100) {
        this.trickle();
      }
    };
    this.animationId = requestAnimationFrame(tick);
  }

  private trickle(): void {
    const tick = () => {
      const current = this.progress();
      if (current >= 95) return;
      const increment = current < 80 ? 0.5 : current < 90 ? 0.2 : 0.05;
      this.progress.set(Math.min(current + increment, 95));
      this.animationId = requestAnimationFrame(() => {
        setTimeout(() => {
          this.animationId = requestAnimationFrame(tick);
        }, 200);
      });
    };
    this.animationId = requestAnimationFrame(tick);
  }

  private cancelAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
