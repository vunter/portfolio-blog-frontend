import { Component, OnInit, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AccountPrivacyService,
  AccountConsent,
  NewsletterAccountStatus,
} from '../../../../core/services/account-privacy.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';

type NewsletterAction = 'link' | 'unlink' | 'subscribe' | 'unsubscribe';
type ConsentKind = 'site' | 'email';

@Component({
  selector: 'app-newsletter-privacy',
  imports: [DatePipe, RouterLink],
  templateUrl: './newsletter-privacy.component.html',
  styleUrl: './newsletter-privacy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsletterPrivacyComponent implements OnInit {
  private readonly accountPrivacy = inject(AccountPrivacyService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly newsletter = signal<NewsletterAccountStatus | null>(null);
  readonly consent = signal<AccountConsent | null>(null);
  /** Which newsletter action is in flight (disables the action buttons). */
  readonly pendingAction = signal<NewsletterAction | null>(null);
  /** Which consent toggle is being saved. */
  readonly savingConsent = signal<ConsentKind | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    forkJoin({
      newsletter: this.accountPrivacy.getNewsletterStatus(),
      consent: this.accountPrivacy.getConsent(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ newsletter, consent }) => {
          this.newsletter.set(newsletter);
          this.consent.set(consent);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  setConsent(kind: ConsentKind, value: boolean): void {
    if (this.savingConsent() !== null) return;
    this.savingConsent.set(kind);
    const update =
      kind === 'site' ? { siteAnalyticsConsent: value } : { emailAnalyticsConsent: value };
    this.accountPrivacy
      .updateConsent(update)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (consent) => {
          this.consent.set(consent);
          this.savingConsent.set(null);
          this.notification.success(this.i18n.t('account.privacy.consentSaved'));
        },
        error: () => {
          this.savingConsent.set(null);
          this.notification.error(this.i18n.t('account.privacy.consentSaveFailed'));
        },
      });
  }

  onConsentToggle(kind: ConsentKind, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setConsent(kind, input.checked);
  }

  runNewsletterAction(action: NewsletterAction): void {
    if (this.pendingAction() !== null) return;
    this.pendingAction.set(action);
    const request$ = {
      link: () => this.accountPrivacy.linkNewsletter(),
      unlink: () => this.accountPrivacy.unlinkNewsletter(),
      subscribe: () => this.accountPrivacy.subscribeNewsletter(),
      unsubscribe: () => this.accountPrivacy.unsubscribeNewsletter(),
    }[action]();

    const successKey = {
      link: 'account.privacy.linked',
      unlink: 'account.privacy.unlinked',
      subscribe: 'account.privacy.subscribed',
      unsubscribe: 'account.privacy.unsubscribed',
    }[action];

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.pendingAction.set(null);
        this.notification.success(this.i18n.t(successKey));
        this.refreshNewsletter();
      },
      error: () => {
        this.pendingAction.set(null);
        this.notification.error(this.i18n.t('account.privacy.actionFailed'));
      },
    });
  }

  consentStatusKey(value: boolean | null): string {
    if (value === null) return 'account.privacy.consentNotSet';
    return value ? 'account.privacy.consentGiven' : 'account.privacy.consentDeclined';
  }

  private refreshNewsletter(): void {
    this.accountPrivacy
      .getNewsletterStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => this.newsletter.set(status),
        error: () => {
          /* keep last known state; the action itself already succeeded */
        },
      });
  }
}
