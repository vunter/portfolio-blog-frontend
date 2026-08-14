import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

/** GET /account/newsletter */
export interface NewsletterAccountStatus {
  subscribed: boolean;
  linked: boolean;
  subscriberStatus: string | null;
  linkedAt: string | null;
  emailAnalyticsConsent: boolean | null;
}

/** GET/PUT /account/consent — two DISTINCT LGPD purposes, never merged. */
export interface AccountConsent {
  siteAnalyticsConsent: boolean | null;
  emailAnalyticsConsent: boolean | null;
}

export interface AccountConsentUpdate {
  siteAnalyticsConsent?: boolean;
  emailAnalyticsConsent?: boolean;
}

/** GET /account/deletion-preview */
export interface AccountDeletionPreview {
  newsletterLinked: boolean;
  newsletterStatus: string | null;
  commentsCount: number;
  articlesCount: number;
}

export type AccountDeletionMode = 'DEACTIVATE' | 'ERASE';

export interface AccountDeletionRequest {
  password: string;
  mode: AccountDeletionMode;
  cancelNewsletter: boolean;
}

/**
 * Self-service account privacy operations: newsletter↔account link management,
 * analytics consents (LGPD) and account deactivation/erasure.
 */
@Injectable({ providedIn: 'root' })
export class AccountPrivacyService {
  private readonly api = inject(ApiService);

  getNewsletterStatus(): Observable<NewsletterAccountStatus> {
    return this.api.get<NewsletterAccountStatus>('/account/newsletter');
  }

  linkNewsletter(): Observable<void> {
    return this.api.post<void>('/account/newsletter/link');
  }

  unlinkNewsletter(): Observable<void> {
    return this.api.delete<void>('/account/newsletter/link');
  }

  subscribeNewsletter(): Observable<void> {
    return this.api.post<void>('/account/newsletter/subscribe');
  }

  unsubscribeNewsletter(): Observable<void> {
    return this.api.post<void>('/account/newsletter/unsubscribe');
  }

  getConsent(): Observable<AccountConsent> {
    return this.api.get<AccountConsent>('/account/consent');
  }

  updateConsent(update: AccountConsentUpdate): Observable<AccountConsent> {
    return this.api.put<AccountConsent>('/account/consent', update);
  }

  getDeletionPreview(): Observable<AccountDeletionPreview> {
    return this.api.get<AccountDeletionPreview>('/account/deletion-preview');
  }

  deleteAccount(request: AccountDeletionRequest): Observable<void> {
    return this.api.deleteWithBody<void>('/account', request);
  }
}
