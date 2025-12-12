import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CookieConsentService } from '../../../core/services/cookie-consent.service';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-cookie-consent',
  templateUrl: './cookie-consent.component.html',
  styleUrl: './cookie-consent.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookieConsentComponent {
  private consentService = inject(CookieConsentService);
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
  }

  goToPrivacy(): void {
    this.consentService.showBanner.set(false);
    this.router.navigate(['/privacy']);
  }
}
