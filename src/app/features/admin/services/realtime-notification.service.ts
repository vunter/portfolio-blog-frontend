import { Injectable, signal, computed, NgZone, inject, DestroyRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../core/services/notification.service';
import { I18nService } from '../../../core/services/i18n.service';

/** Reconnection configuration constants */
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;

export interface ServerNotificationEvent {
  type: string;
  action: string;
  title: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/** Maps SSE event type+data to an admin route */
export function resolveRoute(event: ServerNotificationEvent): string {
  const routeMap: Record<string, string> = {
    contact: '/admin/contacts',
    article: '/admin/articles',
    comment: '/admin/comments',
    subscriber: '/admin/newsletter',
    auth: '/admin/security',
  };
  const base = routeMap[event.type] ?? '/admin/dashboard';

  if (event.type === 'article' && event.data?.['slug']) {
    return `${base}/${event.data['slug']}/edit`;
  }
  return base;
}

@Injectable({ providedIn: 'root' })
export class RealtimeNotificationService {
  private readonly zone = inject(NgZone);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly eventTypes = ['article', 'comment', 'subscriber', 'contact', 'auth'] as const;
  private boundHandler: ((e: MessageEvent) => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private wasConnectedBeforeHidden = false;

  private readonly _connected = signal(false);
  private readonly _events = signal<ServerNotificationEvent[]>([]);
  private readonly _unreadCount = signal(0);

  readonly connected = this._connected.asReadonly();
  readonly events = this._events.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly hasUnread = computed(() => this._unreadCount() > 0);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.disconnect();
      this.removeVisibilityListener();
    });
  }

  connect(): void {
    if (this.eventSource || !isPlatformBrowser(this.platformId)) {
      return;
    }

    this.setupVisibilityListener();

    const url = `${environment.apiUrl}/${environment.apiVersion}/admin/notifications/stream`;

    this.zone.runOutsideAngular(() => {
      this.eventSource = new EventSource(url, { withCredentials: true });

      this.eventSource.onopen = () => {
        this.zone.run(() => {
          this._connected.set(true);
          this.reconnectAttempts = 0;
        });
      };

      this.boundHandler = (e: MessageEvent) => this.handleEvent(e);
      for (const type of this.eventTypes) {
        this.eventSource.addEventListener(type, this.boundHandler);
      }

      this.eventSource.onerror = () => {
        this.zone.run(() => {
          this._connected.set(false);
          this.eventSource?.close();
          this.eventSource = null;
          this.scheduleReconnect();
        });
      };
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      if (this.boundHandler) {
        for (const type of this.eventTypes) {
          this.eventSource.removeEventListener(type, this.boundHandler);
        }
        this.boundHandler = null;
      }
      this.eventSource.close();
      this.eventSource = null;
    }
    this._connected.set(false);
    this.reconnectAttempts = 0;
  }

  /** Pause SSE when tab is hidden, resume when visible */
  private setupVisibilityListener(): void {
    if (this.visibilityHandler) return;
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.wasConnectedBeforeHidden = !!this.eventSource;
        if (this.eventSource) {
          this.disconnect();
        }
      } else if (this.wasConnectedBeforeHidden) {
        this.wasConnectedBeforeHidden = false;
        this.connect();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private removeVisibilityListener(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  markAllRead(): void {
    this._unreadCount.set(0);
  }

  clearEvents(): void {
    this._events.set([]);
    this._unreadCount.set(0);
  }

  private handleEvent(event: MessageEvent): void {
    try {
      const data: ServerNotificationEvent = JSON.parse(event.data);
      const route = resolveRoute(data);
      this.zone.run(() => {
        this._events.update(current => [data, ...current].slice(0, 50));
        this._unreadCount.update(c => Math.min(c + 1, 99));
        this.notifications.info(data.title, undefined, route);
      });
    } catch {
      // Ignore malformed events
    }
  }

  // INC-11: Signal indicating max reconnection attempts exhausted
  private readonly _connectionLost = signal(false);
  readonly connectionLost = this._connectionLost.asReadonly();

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      // INC-11: Notify user that real-time connection was lost
      this._connectionLost.set(true);
      this.notifications.error(
        this.i18n.t('account.notifications.connectionLost')
      );
      return;
    }
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts), RECONNECT_MAX_DELAY_MS);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
