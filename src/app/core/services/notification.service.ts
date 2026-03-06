import { Injectable, signal, computed } from '@angular/core';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  route?: string;
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

  dismiss(id: string): void {
    this._notifications.update((current) => current.filter((n) => n.id !== id));
  }

  dismissAll(): void {
    this._notifications.set([]);
  }
}
