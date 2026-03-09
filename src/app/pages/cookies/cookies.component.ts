import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { SeoService } from '../../core/services/seo.service';
import { CookieConsentService } from '../../core/services/cookie-consent.service';

@Component({
  selector: 'app-cookies',
  templateUrl: './cookies.component.html',
  styleUrl: './cookies.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookiesComponent implements OnInit {
  i18n = inject(I18nService);
  private seo = inject(SeoService);
  private consentService = inject(CookieConsentService);

  ngOnInit(): void {
    this.seo.update({
      title: this.i18n.t('cookies.title'),
      description: this.i18n.t('seo.cookies.description'),
      url: '/cookies',
      type: 'website',
      noIndex: true,
      locale: this.seo.getLocale(this.i18n.language()),
    });
  }

  openCookieSettings(): void {
    this.consentService.reopenBanner();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
