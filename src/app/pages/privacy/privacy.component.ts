import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent implements OnInit {
  i18n = inject(I18nService);
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.update({
      title: this.i18n.t('privacy.title'),
      description: this.i18n.t('seo.privacy.description'),
      url: '/privacy',
      type: 'website',
      noIndex: true,
      locale: this.seo.getLocale(this.i18n.language()),
    });
  }
}
