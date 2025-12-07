import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly _visible = signal(false);
  private readonly _options = signal<ConfirmDialogOptions>({
    title: '',
    message: '',
  });

  readonly visible = this._visible.asReadonly();
  readonly options = this._options.asReadonly();

  private resolvePromise: ((value: boolean) => void) | null = null;

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    this._options.set(options);
    this._visible.set(true);

    return new Promise<boolean>((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  accept(): void {
    this._visible.set(false);
    this.resolvePromise?.(true);
    this.resolvePromise = null;
  }

  cancel(): void {
    this._visible.set(false);
    this.resolvePromise?.(false);
    this.resolvePromise = null;
  }
}
