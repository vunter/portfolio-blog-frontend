import { Component, inject, signal, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { RealtimeNotificationService, ServerNotificationEvent } from '../../services/realtime-notification.service';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-notification-bell',
  template: `
    <div class="notification-bell" (click)="toggleDropdown($event)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      @if (notifications.hasUnread()) {
        <span class="badge">{{ notifications.unreadCount() > 9 ? '9+' : notifications.unreadCount() }}</span>
      }
    </div>

    @if (open()) {
      <div class="dropdown" (click)="$event.stopPropagation()">
        <div class="dropdown__header">
          <span class="dropdown__title">{{ i18n.t('account.notifications.title') }}</span>
          @if (notifications.hasUnread()) {
            <button class="dropdown__mark-read" (click)="notifications.markAllRead()">
              {{ i18n.t('account.notifications.markAllRead') }}
            </button>
          }
        </div>
        <div class="dropdown__list">
          @for (event of notifications.events(); track $index) {
            <div class="dropdown__item">
              <span class="dropdown__icon" [attr.data-type]="event.type">{{ getIcon(event.type) }}</span>
              <div class="dropdown__content">
                <span class="dropdown__item-title">{{ event.title }}</span>
                <span class="dropdown__time">{{ formatTime(event.timestamp) }}</span>
              </div>
            </div>
          } @empty {
            <div class="dropdown__empty">{{ i18n.t('account.notifications.empty') }}</div>
          }
        </div>
        @if (notifications.events().length > 0) {
          <div class="dropdown__footer">
            <button class="dropdown__clear" (click)="notifications.clearEvents(); open.set(false)">
              {{ i18n.t('account.notifications.clearAll') }}
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      position: relative;
      display: inline-flex;
    }

    .notification-bell {
      position: relative;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      color: var(--text-secondary, #6b7280);
      transition: all 0.2s;

      &:hover {
        background: var(--bg-secondary, #f3f4f6);
        color: var(--text-primary, #111827);
      }
    }

    .badge {
      position: absolute;
      top: 2px;
      right: 2px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: var(--color-danger, #ef4444);
      color: white;
      font-size: 0.625rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    .dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 320px;
      max-height: 400px;
      background: var(--bg-primary, white);
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      z-index: 100;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .dropdown__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
    }

    .dropdown__title {
      font-weight: 600;
      font-size: 0.875rem;
    }

    .dropdown__mark-read {
      background: none;
      border: none;
      color: var(--color-accent, #3b82f6);
      font-size: 0.75rem;
      cursor: pointer;
      padding: 0;

      &:hover { text-decoration: underline; }
    }

    .dropdown__list {
      overflow-y: auto;
      max-height: 300px;
    }

    .dropdown__item {
      display: flex;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color-light, #f3f4f6);
      transition: background 0.15s;

      &:hover { background: var(--bg-secondary, #f9fafb); }
      &:last-child { border-bottom: none; }
    }

    .dropdown__icon {
      font-size: 1.25rem;
      flex-shrink: 0;
      width: 28px;
      text-align: center;
    }

    .dropdown__content {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-width: 0;
    }

    .dropdown__item-title {
      font-size: 0.8125rem;
      line-height: 1.3;
      color: var(--text-primary, #111827);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dropdown__time {
      font-size: 0.6875rem;
      color: var(--text-tertiary, #9ca3af);
    }

    .dropdown__empty {
      padding: 2rem 1rem;
      text-align: center;
      color: var(--text-tertiary, #9ca3af);
      font-size: 0.8125rem;
    }

    .dropdown__footer {
      padding: 0.5rem 1rem;
      border-top: 1px solid var(--border-color, #e5e7eb);
      text-align: center;
    }

    .dropdown__clear {
      background: none;
      border: none;
      color: var(--text-secondary, #6b7280);
      font-size: 0.75rem;
      cursor: pointer;
      padding: 0;

      &:hover { color: var(--color-danger, #ef4444); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBellComponent {
  readonly notifications = inject(RealtimeNotificationService);
  readonly i18n = inject(I18nService);
  open = signal(false);

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.open()) {
      this.open.set(false);
    }
  }

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.open.update(v => !v);
    if (this.open()) {
      this.notifications.markAllRead();
    }
  }

  getIcon(type: string): string {
    const icons: Record<string, string> = {
      article: '📝',
      comment: '💬',
      subscriber: '📧',
      contact: '📩',
      auth: '🔐',
    };
    return icons[type] || '🔔';
  }

  formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return this.i18n.t('account.notifications.justNow');
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return date.toLocaleDateString();
  }
}
