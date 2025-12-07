import { Injectable, inject, signal, effect, untracked, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
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

  /** The currently active alias — writable for future profile selector */
  readonly activeAlias = signal<string>(environment.ownerAlias);

  /** List of all published developer profiles (loaded on demand) */
  readonly availableProfiles = signal<PublicProfileSummary[]>([]);

  // CQ-10: Track current subscription to cancel on rapid language changes
  // TODO F-326: Refactor to Subject with switchMap for automatic cancellation
  private currentFetch: Subscription | null = null;
  private profilesFetch: Subscription | null = null;

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
    // Fetch profile on init and re-fetch when language or alias changes
    // BUG-04: Run on both server and browser — Angular's HttpClient transfer state
    // (via provideClientHydration) caches server-side responses for the browser
    effect(() => {
      const lang = this.i18n.language();
      const alias = this.activeAlias();
      // Use untracked for fetch to avoid signal update loops
      untracked(() => this.fetchProfile(lang, alias));
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
    // CQ-10: Cancel any in-flight request before starting a new one
    this.currentFetch?.unsubscribe();
    // INT-10: Normalize locale — map 'pt' to 'pt-br' to match backend data
    const normalizedLang = lang === 'pt' ? 'pt-br' : lang;

    // I-05: Return cached profile if available for this alias+locale
    const cacheKey = `${alias}:${normalizedLang}`;
    const cached = this.localeCache.get(cacheKey);
    if (cached) {
      this.profile.set(cached);
      this.loading.set(false);
      this.loaded.set(true);
      this.error.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(false);
    // INT-02: Use ApiService-compatible URL construction with withCredentials
    const url = `${environment.apiUrl}/${environment.apiVersion}/public/resume/${alias}/profile?lang=${normalizedLang}`;

    this.currentFetch = this.http.get<ResumeProfile>(url, { withCredentials: true }).subscribe({
      next: (profile) => {
        untracked(() => {
          this.localeCache.set(cacheKey, profile);
          this.profile.set(profile);
          this.loading.set(false);
          this.loaded.set(true);
        });
      },
      error: () => {
        untracked(() => {
          this.profile.set(null);
          this.loading.set(false);
          this.loaded.set(true);
          this.error.set(true);
        });
      }
    });
  }

  /** Retry loading the profile */
  retry(): void {
    this.fetchProfile(this.i18n.language(), this.activeAlias());
  }
}
