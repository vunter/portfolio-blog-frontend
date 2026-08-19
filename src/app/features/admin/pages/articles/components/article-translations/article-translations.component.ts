import { Component, inject, input, signal, ChangeDetectionStrategy, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { AdminApiService } from '../../../../services/admin-api.service';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { I18nService } from '../../../../../../core/services/i18n.service';
import { ArticleI18nResponse } from '../../../../../../models';

@Component({
  selector: 'app-article-translations',
  imports: [DatePipe],
  templateUrl: './article-translations.component.html',
  styleUrl: './article-translations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleTranslationsComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);

  articleId = input.required<string>();

  translations = signal<ArticleI18nResponse[]>([]);
  availableLocales = signal<string[]>([]);
  showPanel = signal(false);
  selectedLocale = signal('');
  translating = signal(false);
  // AUD18-05: distinguish failed loads from "no translations"/"no locales"
  loadError = signal(false);

  ngOnInit(): void {
    this.loadTranslations();
    this.loadAvailableLocales();
  }

  // AUD18-05: single retry entry point for the panel's error state
  retryLoad(): void {
    this.loadError.set(false);
    this.loadTranslations();
    this.loadAvailableLocales();
  }

  loadTranslations(): void {
    this.adminApi.getArticleTranslations(this.articleId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (translations) => this.translations.set(translations),
      // AUD18-05: previously subscribe({next}) had no error branch, so a failed
      // load was indistinguishable from an article without translations.
      error: () => this.loadError.set(true),
    });
  }

  loadAvailableLocales(): void {
    this.adminApi.getArticleTranslationLocales(this.articleId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (locales) => this.availableLocales.set(locales),
      error: () => this.loadError.set(true),
    });
  }

  translate(targetLang: string): void {
    if (!targetLang) return;
    this.translating.set(true);
    this.adminApi.translateArticle(this.articleId(), targetLang).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.translating.set(false);
        this.notification.success(this.i18n.t('dev.articles.translationAdded'));
        this.loadTranslations();
        this.loadAvailableLocales();
        this.selectedLocale.set('');
      },
      error: () => {
        this.translating.set(false);
        this.notification.error(this.i18n.t('dev.articles.translationError'));
      },
    });
  }

  deleteTranslation(locale: string): void {
    if (!confirm(this.i18n.t('dev.articles.deleteTranslationConfirm', { locale }))) return;
    this.adminApi.deleteArticleTranslation(this.articleId(), locale).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('dev.articles.translationDeleted'));
        this.loadTranslations();
        this.loadAvailableLocales();
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.articles.translationDeleteError'));
      },
    });
  }
}
