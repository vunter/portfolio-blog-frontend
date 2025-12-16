import { Component, inject, signal, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-newsletter-confirm',
  imports: [RouterLink],
  templateUrl: './newsletter-confirm.component.html',
  styleUrl: './newsletter-confirm.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsletterConfirmComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);

  loading = signal(true);
  success = signal(false);

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const token = params['token'];
      if (token) {
        this.confirmSubscription(token);
      } else {
        this.loading.set(false);
        this.success.set(false);
      }
    });
  }

  private confirmSubscription(token: string): void {
    this.loading.set(true);
    this.apiService.get<{ message: string }>('/newsletter/confirm', { token }).subscribe({
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
