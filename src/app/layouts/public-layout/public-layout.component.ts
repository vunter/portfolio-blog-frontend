import { Component, ChangeDetectionStrategy, inject, signal, computed, PLATFORM_ID, OnInit, DestroyRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, throttleTime } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { ThemeService } from '../../core/services/theme.service';
import { I18nService } from '../../core/services/i18n.service';
import { PublicProfileService } from '../../core/services/public-profile.service';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-public-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ThemeToggleComponent],
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
  currentYear = new Date().getFullYear();
  mobileMenuOpen = signal(false);
  showScrollTop = signal(false);
  userMenuOpen = signal(false);
  langMenuOpen = signal(false);

  readonly currentLangLabel = computed(() => {
    const labels: Record<string, string> = { en: 'EN', pt: 'PT', es: 'ES', it: 'IT' };
    return labels[this.i18n.language()] || 'EN';
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

  selectLanguage(lang: 'en' | 'pt' | 'es' | 'it'): void {
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

  logout(): void {
    this.authStore.logout();
    this.closeUserMenu();
    this.closeMobileMenu();
    this.router.navigate(['/']);
  }
}
