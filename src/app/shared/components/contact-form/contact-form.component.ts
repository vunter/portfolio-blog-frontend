import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RecaptchaService } from '../../../core/services/recaptcha.service';

@Component({
  selector: 'app-contact-form',
  imports: [ReactiveFormsModule],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactFormComponent {
  readonly i18n = inject(I18nService);
  private readonly notification = inject(NotificationService);
  private readonly api = inject(ApiService);
  private readonly recaptcha = inject(RecaptchaService);
  private readonly fb = inject(FormBuilder);

  contactForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    subject: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
    message: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(2000)]],
  });

  submitting = signal(false);
  success = signal(false);
  submitted = signal(false);

  async submitForm(): Promise<void> {
    if (this.contactForm.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.success.set(false);
    this.submitted.set(false);

    try {
      const formData = this.contactForm.getRawValue();
      const recaptchaToken = await this.recaptcha.execute('contact');
      await firstValueFrom(this.api.post('/contact', { ...formData, recaptchaToken }));

      // BUG-RT13: Show notification FIRST, then flag submitted to suppress validation flash
      this.notification.success(this.i18n.t('contactForm.successNotification'));
      this.submitted.set(true);
      this.success.set(true);

      // Reset form after success is signalled
      this.contactForm.reset();

      // Hide success message after 5 seconds
      setTimeout(() => this.success.set(false), 5000);
    } catch (error) {
      this.notification.error(this.i18n.t('contactForm.errorNotification'));
    } finally {
      this.submitting.set(false);
    }
  }
}
