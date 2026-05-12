import { Injectable, signal, computed } from '@angular/core';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  route?: string;
  undoAction?: () => void;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly _notifications = signal<Notification[]>([]);
  readonly notifications = this._notifications.asReadonly();
  readonly hasNotifications = computed(() => this._notifications().length > 0);

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  private show(type: Notification['type'], message: string, duration = 5000, route?: string): string {
    const id = this.generateId();
    const notification: Notification = { id, type, message, duration, ...(route ? { route } : {}) };

    this._notifications.update((current) => [...current, notification]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  success(message: string, duration?: number): string {
    return this.show('success', message, duration);
  }

  error(message: string, duration?: number): string {
    return this.show('error', message, duration ?? 8000);
  }

  warning(message: string, duration?: number): string {
    return this.show('warning', message, duration);
  }

  info(message: string, duration?: number, route?: string): string {
    return this.show('info', message, duration, route);
  }

  /**
   * Q7.7: Show success toast with an optional undo callback.
   * The undo action is available for the notification's duration (default 5s).
   */
  successWithUndo(message: string, undoAction: () => void, duration = 5000): string {
    const id = this.generateId();
    const notification: Notification = { id, type: 'success', message, duration, undoAction };
    this._notifications.update((current) => [...current, notification]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    return id;
  }

  undo(id: string): void {
    const notification = this._notifications().find(n => n.id === id);
    if (notification?.undoAction) {
      notification.undoAction();
      this.dismiss(id);
    }
  }

  dismiss(id: string): void {
    this._notifications.update((current) => current.filter((n) => n.id !== id));
  }

  dismissAll(): void {
    this._notifications.set([]);
  }
}
