import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
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
  // M-06: Inject I18nService for translated aria-label
  readonly i18n = inject(I18nService);

  dismiss(id: string): void {
    this.notificationService.dismiss(id);
  }
}
