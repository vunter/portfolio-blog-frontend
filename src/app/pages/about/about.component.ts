import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { I18nService } from '../../core/services/i18n.service';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-about',
  imports: [NgOptimizedImage],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnInit {
  i18n = inject(I18nService);
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.update({
      title: this.i18n.t('about.title'),
      description: this.i18n.t('seo.about.description'),
      url: '/about',
      type: 'website',
      locale: this.seo.getLocale(this.i18n.language()),
    });
  }
}
