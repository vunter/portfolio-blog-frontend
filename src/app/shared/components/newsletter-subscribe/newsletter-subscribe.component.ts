import { Component, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RecaptchaService } from '../../../core/services/recaptcha.service';

/**
 * INC-07: Newsletter subscribe form component.
 * Public-facing inline form for newsletter subscription.
 */
@Component({
  selector: 'app-newsletter-subscribe',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './newsletter-subscribe.component.html',
  styleUrl: './newsletter-subscribe.component.scss',
})
export class NewsletterSubscribeComponent {
  private api = inject(ApiService);
  readonly i18n = inject(I18nService);
  private notification = inject(NotificationService);
  private recaptcha = inject(RecaptchaService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  subscribeForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    analyticsConsent: [false],
  });
  submitting = signal(false);
  subscribed = signal(false);

  subscribe(): void {
    const emailValue = (this.subscribeForm.get('email')?.value ?? '').trim();
    if (!emailValue || this.subscribeForm.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.recaptcha.execute('subscribe').then(recaptchaToken => {
      this.api.post<{ message: string }>('/newsletter/subscribe', {
          email: emailValue,
          recaptchaToken,
          analyticsConsent: this.subscribeForm.get('analyticsConsent')?.value ?? false,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.subscribed.set(true);
            this.notification.success(this.i18n.t('newsletter.subscribe.success'));
          },
          error: () => {
            this.notification.error(this.i18n.t('newsletter.subscribe.error'));
            this.submitting.set(false);
          },
        });
    }).catch(() => {
      this.submitting.set(false);
      this.notification.error(this.i18n.t('newsletter.subscribe.error'));
    });
  }
}
