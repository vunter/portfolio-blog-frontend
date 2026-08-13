import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { I18nService } from '../../../../core/services/i18n.service';

type VerifyState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-verify-email',
  imports: [RouterLink],
  template: `
    <div class="verify-container">
      @switch (state()) {
        @case ('loading') {
          <div class="verify-card">
            <div class="spinner" aria-hidden="true"></div>
            <p role="status">{{ i18n.t('auth.verifyEmail.loading') }}</p>
          </div>
        }
        @case ('success') {
          <div class="verify-card success">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <h1>{{ i18n.t('auth.verifyEmail.successTitle') }}</h1>
            <a routerLink="/auth/login" class="btn btn-primary">{{ i18n.t('auth.verifyEmail.goToLogin') }}</a>
          </div>
        }
        @case ('error') {
          <div class="verify-card error">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <h1>{{ i18n.t('auth.verifyEmail.errorTitle') }}</h1>
            <p role="alert">{{ i18n.t('auth.verifyEmail.errorBody') }}</p>
            <a routerLink="/auth/login" class="btn btn-primary">{{ i18n.t('auth.verifyEmail.goToLogin') }}</a>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .verify-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      padding: 2rem;
    }
    .verify-card {
      text-align: center;
      padding: 2.5rem;
      border-radius: 12px;
      background: var(--bg-primary, white);
      border: 1px solid var(--border-color, #e5e7eb);
      max-width: 420px;
      width: 100%;
    }
    .verify-card svg { margin-bottom: 1rem; }
    .verify-card.success svg { color: var(--success-color, #22c55e); }
    .verify-card.error svg { color: var(--error-color, #ef4444); }
    .verify-card h1 { margin: 0 0 0.5rem; font-size: 1.25rem; }
    .verify-card p { color: var(--text-secondary); margin-bottom: 1.5rem; }
    .spinner {
      width: 32px; height: 32px; margin: 0 auto 1rem;
      border: 3px solid var(--border-color, #e5e7eb);
      border-top-color: var(--primary-color, #6366f1);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn-primary {
      display: inline-block; padding: 0.625rem 1.5rem;
      background: var(--primary-color, #6366f1); color: white;
      border-radius: 8px; text-decoration: none; font-weight: 500;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);

  readonly state = signal<VerifyState>('loading');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('error');
      return;
    }
    this.api.get<{ message: string }>('/admin/auth/verify-email', { token }).subscribe({
      next: () => this.state.set('success'),
      error: () => this.state.set('error'),
    });
  }
}
