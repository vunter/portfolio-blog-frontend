import { Injectable, inject, signal, effect, untracked, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, switchMap, EMPTY, tap, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ResumeProfile } from '../../models/resume-profile.model';
import { I18nService } from './i18n.service';
import { environment } from '../../../environments/environment';

/**
 * Summary DTO for listing published developer profiles.
 * Matches backend PublicProfileSummary.
 */
export interface PublicProfileSummary {
  alias: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
}

/**
 * Service to fetch the public resume profile data (no authentication required).
 * Used by the Home page components to render dynamic portfolio content.
 *
 * Supports dynamic alias switching for multi-developer profile selector (F-500).
 * Default alias comes from environment.ownerAlias ('leonardo-catananti').
 */
@Injectable({ providedIn: 'root' })
export class PublicProfileService {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** The currently active alias — writable for future profile selector */
  readonly activeAlias = signal<string>(environment.ownerAlias);

  /** List of all published developer profiles (loaded on demand) */
  readonly availableProfiles = signal<PublicProfileSummary[]>([]);

  // CQ-10: Subject + switchMap for automatic cancellation of rapid language/alias changes
  private readonly fetchTrigger$ = new Subject<{ lang: string; alias: string }>();
  private profilesFetch: import('rxjs').Subscription | null = null;

  // I-05: Locale-based cache — avoids re-fetching previously loaded profiles
  // Key format: "alias:locale" (e.g., "leonardo-catananti:en")
  private readonly localeCache = new Map<string, ResumeProfile>();

  /** The loaded profile, or null if not yet loaded / failed */
  readonly profile = signal<ResumeProfile | null>(null);

  /** Whether the profile is currently being loaded */
  readonly loading = signal(false);

  /** Whether the initial load has completed (success or failure) */
  readonly loaded = signal(false);

  /** Whether the last fetch resulted in an error */
  readonly error = signal(false);

  constructor() {
    // CQ-10: switchMap auto-cancels previous in-flight requests on rapid changes
    this.fetchTrigger$.pipe(
      switchMap(({ lang, alias }) => {
        const normalizedLang = lang === 'pt' ? 'pt-br' : lang;
        const cacheKey = `${alias}:${normalizedLang}`;
        const cached = this.localeCache.get(cacheKey);
        if (cached) {
          this.profile.set(cached);
          this.loading.set(false);
          this.loaded.set(true);
          this.error.set(false);
          return EMPTY;
        }
        this.loading.set(true);
        this.error.set(false);
        const url = `${environment.apiUrl}/${environment.apiVersion}/public/resume/${alias}/profile?lang=${normalizedLang}`;
        return this.http.get<ResumeProfile>(url, { withCredentials: true }).pipe(
          tap((profile) => {
            untracked(() => {
              this.localeCache.set(cacheKey, profile);
              this.profile.set(profile);
              this.loading.set(false);
              this.loaded.set(true);
            });
          }),
          catchError(() => {
            untracked(() => {
              this.profile.set(null);
              this.loading.set(false);
              this.loaded.set(true);
              this.error.set(true);
            });
            return EMPTY;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();

    // Fetch profile on init and re-fetch when language or alias changes
    // BUG-04: Run on both server and browser — Angular's HttpClient transfer state
    // (via provideClientHydration) caches server-side responses for the browser
    effect(() => {
      const lang = this.i18n.language();
      const alias = this.activeAlias();
      untracked(() => this.fetchTrigger$.next({ lang, alias }));
    });
  }

  /**
   * Switch to a different developer's profile by alias.
   * Triggers an automatic re-fetch via the effect.
   */
  setAlias(alias: string): void {
    if (alias && alias !== this.activeAlias()) {
      this.activeAlias.set(alias);
    }
  }

  /**
   * Load the list of all published developer profiles.
   * Called on demand — not loaded automatically to avoid unnecessary requests.
   */
  loadAvailableProfiles(): void {
    this.profilesFetch?.unsubscribe();
    const normalizedLang = this.i18n.language() === 'pt' ? 'pt-br' : this.i18n.language();
    const url = `${environment.apiUrl}/${environment.apiVersion}/public/resume/profiles?lang=${normalizedLang}`;

    this.profilesFetch = this.http.get<PublicProfileSummary[]>(url, { withCredentials: true }).subscribe({
      next: (profiles) => this.availableProfiles.set(profiles),
      error: () => this.availableProfiles.set([]),
    });
  }

  private fetchProfile(lang: string, alias: string): void {
    this.fetchTrigger$.next({ lang, alias });
  }

  /** Retry loading the profile */
  retry(): void {
    this.fetchProfile(this.i18n.language(), this.activeAlias());
  }
}
