import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  ElementRef,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { I18nService } from '../../../core/services/i18n.service';
import { UserResponse } from '../../../models/user.model';

@Component({
  selector: 'app-terms-acceptance-modal',
  imports: [FormsModule, RouterLink],
  templateUrl: './terms-acceptance-modal.component.html',
  styleUrl: './terms-acceptance-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsAcceptanceModalComponent {
  private readonly authStore = inject(AuthStore);
  private readonly api = inject(ApiService);
  private readonly notification = inject(NotificationService);
  private readonly elementRef = inject(ElementRef);
  readonly i18n = inject(I18nService);

  readonly termsChecked = signal(false);
  readonly loading = signal(false);

  readonly visible = computed(() => {
    const user = this.authStore.user();
    return !!user && user.termsAccepted === false && user.hasPassword !== false;
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        setTimeout(() => {
          const btn = this.elementRef.nativeElement.querySelector(
            '.terms-modal__actions button:last-child'
          ) as HTMLElement | null;
          btn?.focus();
        });
      }
    });
  }

  onTabTrap(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusable = this.elementRef.nativeElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  accept(): void {
    if (!this.termsChecked() || this.loading()) return;
    this.loading.set(true);

    this.api
      .putResponse<UserResponse>('/admin/users/me', { termsAccepted: true })
      .subscribe({
        next: (res) => {
          const updated = res.body;
          if (updated) {
            this.authStore.updateUser(updated);
          }
          this.notification.success(this.i18n.t('terms.accepted'));
          this.loading.set(false);
        },
        error: () => {
          this.notification.error(this.i18n.t('terms.acceptError'));
          this.loading.set(false);
        },
      });
  }

  decline(): void {
    this.authStore.logout();
  }
}
