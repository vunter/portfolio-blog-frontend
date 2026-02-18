import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';

/**
 * INC-07: Newsletter subscribe form component.
 * Public-facing inline form for newsletter subscription.
 */
// TODO F-394: Add reCAPTCHA verification consistent with contact form
@Component({
  selector: 'app-newsletter-subscribe',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './newsletter-subscribe.component.html',
  styleUrl: './newsletter-subscribe.component.scss',
})
export class NewsletterSubscribeComponent {
  private api = inject(ApiService);
  readonly i18n = inject(I18nService);
  private notification = inject(NotificationService);
  private fb = inject(FormBuilder);

  subscribeForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });
  submitting = signal(false);
  subscribed = signal(false);

  subscribe(): void {
    const emailValue = (this.subscribeForm.get('email')?.value ?? '').trim();
    if (!emailValue || this.subscribeForm.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.api.post<{ message: string }>('/newsletter/subscribe', { email: emailValue }).subscribe({
      next: () => {
        this.subscribed.set(true);
        this.notification.success(this.i18n.t('newsletter.subscribe.success'));
      },
      error: () => {
        this.notification.error(this.i18n.t('newsletter.subscribe.error'));
        this.submitting.set(false);
      },
    });
  }
}
