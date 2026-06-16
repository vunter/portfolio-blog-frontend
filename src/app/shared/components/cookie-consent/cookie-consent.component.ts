import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CookieConsentService } from '../../../core/services/cookie-consent.service';
import { NotificationService } from '../../../core/services/notification.service';
import { I18nService } from '../../../core/services/i18n.service';
import { AccessibleModalDirective } from '../../directives/accessible-modal.directive';

@Component({
  selector: 'app-cookie-consent',
  imports: [AccessibleModalDirective],
  templateUrl: './cookie-consent.component.html',
  styleUrl: './cookie-consent.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookieConsentComponent {
  private consentService = inject(CookieConsentService);
  private notification = inject(NotificationService);
  private router = inject(Router);
  i18n = inject(I18nService);

  showBanner = this.consentService.showBanner;
  showSettings = signal(false);

  // Toggle states for optional categories
  functionalEnabled = signal(true);   // Default: on
  analyticsEnabled = signal(false);   // Default: off

  acceptAll(): void {
    this.consentService.acceptAll();
  }

  rejectOptional(): void {
    this.consentService.rejectOptional();
    // Q14.4: Inform user what features are degraded
    this.notification.info(this.i18n.t('cookie.degradation.rejected'));
  }

  /**
   * Esc handler from AccessibleModalDirective. The banner is a required consent
   * gate, so Esc collapses the expanded settings panel rather than dismissing it.
   */
  onEscape(): void {
    if (this.showSettings()) {
      this.showSettings.set(false);
    }
  }

  toggleSettings(): void {
    const current = this.showSettings();
    if (!current) {
      // Initialize toggles from current consent
      const consent = this.consentService.consent();
      this.functionalEnabled.set(consent.functional);
      this.analyticsEnabled.set(consent.analytics);
    }
    this.showSettings.set(!current);
  }

  savePreferences(): void {
    this.consentService.savePreferences(this.functionalEnabled(), this.analyticsEnabled());
    // Q14.4: Show degradation info if any category was denied
    if (!this.functionalEnabled() || !this.analyticsEnabled()) {
      const parts: string[] = [];
      if (!this.functionalEnabled()) parts.push(this.i18n.t('cookie.degradation.functional'));
      if (!this.analyticsEnabled()) parts.push(this.i18n.t('cookie.degradation.analytics'));
      this.notification.info(parts.join(' '));
    }
  }

  goToPrivacy(): void {
    this.consentService.showBanner.set(false);
    this.router.navigate(['/privacy']);
  }

  goToCookies(): void {
    this.consentService.showBanner.set(false);
    this.router.navigate(['/cookies']);
  }
}
