import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-terms',
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsComponent implements OnInit {
  i18n = inject(I18nService);
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.update({
      title: this.i18n.t('terms.title'),
      description: this.i18n.t('seo.terms.description'),
      url: '/terms',
      type: 'website',
      noIndex: true,
      locale: this.seo.getLocale(this.i18n.language()),
    });
  }
}
