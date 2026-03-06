import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService, Notification } from '../../../core/services/notification.service';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastComponent {
  readonly notificationService = inject(NotificationService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  dismiss(id: string): void {
    this.notificationService.dismiss(id);
  }

  onToastClick(notification: Notification): void {
    if (notification.route) {
      this.router.navigateByUrl(notification.route);
      this.notificationService.dismiss(notification.id);
    }
  }
}
