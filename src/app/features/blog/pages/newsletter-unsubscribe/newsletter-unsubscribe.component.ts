import { Component, inject, signal, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { SeoService } from '../../../../core/services/seo.service';

@Component({
  selector: 'app-newsletter-unsubscribe',
  imports: [RouterLink],
  templateUrl: './newsletter-unsubscribe.component.html',
  styleUrl: './newsletter-unsubscribe.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsletterUnsubscribeComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  private seo = inject(SeoService);
  readonly i18n = inject(I18nService);

  loading = signal(true);
  success = signal(false);

  ngOnInit(): void {
    this.seo.update({
      title: this.i18n.t('newsletter.unsubscribe.title'),
      description: this.i18n.t('seo.newsletter.unsubscribe.description'),
      url: '/newsletter/unsubscribe',
      noIndex: true,
      locale: this.seo.getLocale(this.i18n.language()),
    });

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const token = params['token'];
      if (token) {
        this.unsubscribe(token);
      } else {
        this.loading.set(false);
        this.success.set(false);
      }
    });
  }

  private unsubscribe(token: string): void {
    this.loading.set(true);
    this.apiService.get<{ message: string }>('/newsletter/unsubscribe', { token }).subscribe({
      next: () => {
        this.success.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.success.set(false);
        this.loading.set(false);
      },
    });
  }
}
