import { Component, ChangeDetectionStrategy, inject, signal, computed, PLATFORM_ID, OnInit, DestroyRef, HostListener } from '@angular/core';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, throttleTime, filter } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { ThemeService } from '../../core/services/theme.service';
import { I18nService } from '../../core/services/i18n.service';
import { PublicProfileService } from '../../core/services/public-profile.service';
import { AnalyticsTrackingService } from '../../core/services/analytics-tracking.service';
import { CookieConsentService } from '../../core/services/cookie-consent.service';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-public-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ThemeToggleComponent, NgOptimizedImage],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick()',
  },
})
export class PublicLayoutComponent implements OnInit {
  authStore = inject(AuthStore);
  themeService = inject(ThemeService);
  i18n = inject(I18nService);
  private profileService = inject(PublicProfileService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);
  private analytics = inject(AnalyticsTrackingService);
  private consentService = inject(CookieConsentService);
  currentYear = new Date().getFullYear();
  mobileMenuOpen = signal(false);
  showScrollTop = signal(false);
  userMenuOpen = signal(false);
  langMenuOpen = signal(false);

  readonly currentLangLabel = computed(() => {
    return this.i18n.language().toUpperCase();
  });

  readonly ownerName = computed(() => this.profileService.profile()?.fullName || '');
  readonly ownerEmail = computed(() => this.profileService.profile()?.email || '');
  readonly ownerGithub = computed(() => this.profileService.profile()?.github || '');
  readonly ownerLinkedin = computed(() => this.profileService.profile()?.linkedin || '');

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      fromEvent(window, 'scroll').pipe(
        throttleTime(100),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(() => {
        this.showScrollTop.set(window.scrollY > 400);
      });
    }

    // Track page views for non-article pages
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      // Skip individual article pages — they have dedicated VIEW tracking
      if (url.match(/^\/blog\/[^/]+$/) && url !== '/blog') return;
      this.analytics.trackPageView(url);
    });
  }

  toggleMobileMenu(): void { this.mobileMenuOpen.update(v => !v); }
  closeMobileMenu(): void { this.mobileMenuOpen.set(false); }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen.update(v => !v);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  toggleLangMenu(event: Event): void {
    event.stopPropagation();
    this.langMenuOpen.update(v => !v);
  }

  selectLanguage(lang: string): void {
    this.i18n.setLanguage(lang);
    this.langMenuOpen.set(false);
  }

  // ANG20-06: Moved from @HostListener to host property
  onDocumentClick(): void {
    this.userMenuOpen.set(false);
    this.langMenuOpen.set(false);
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  reopenCookieSettings(): void {
    this.consentService.reopenBanner();
  }

  /** Track outbound link clicks automatically */
  @HostListener('click', ['$event'])
  onOutboundClick(event: Event): void {
    const anchor = (event.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
    if (anchor?.href) {
      try {
        const linkHost = new URL(anchor.href).hostname;
        if (linkHost !== location.hostname) {
          this.analytics.trackOutboundClick(anchor.href, anchor.textContent?.trim());
        }
      } catch { /* invalid URL — ignore */ }
    }
  }

  logout(): void {
    this.authStore.logout();
    this.closeUserMenu();
    this.closeMobileMenu();
    this.router.navigate(['/']);
  }
}
