import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthStore } from '../../../core/auth/auth.store';
import { ThemeService } from '../../../core/services/theme.service';
import { I18nService } from '../../../core/services/i18n.service';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';

interface MenuItem {
  label: string;
  icon: SafeHtml;
  route: string;
}

@Component({
  selector: 'app-resume-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent],
  templateUrl: './resume-layout.component.html',
  styleUrl: './resume-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumeLayoutComponent {
  readonly authStore = inject(AuthStore);
  readonly themeService = inject(ThemeService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  sidebarCollapsed = signal(false);

  menuItems = computed(() => [
    {
      label: this.i18n.t('resume.layout.profile'),
      route: '/admin/profile',
      // SECURITY: bypassSecurityTrustHtml is required here because Angular strips SVG from [innerHTML].
      // These are static, developer-controlled SVG strings — no user input involved.
      icon: this.sanitizer.bypassSecurityTrustHtml('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'),
    },
    {
      label: this.i18n.t('resume.layout.generate'),
      route: '/resume/generate',
      // SECURITY: bypassSecurityTrustHtml is required here because Angular strips SVG from [innerHTML].
      // These are static, developer-controlled SVG strings — no user input involved.
      icon: this.sanitizer.bypassSecurityTrustHtml('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'),
    },
    {
      label: this.i18n.t('resume.layout.templates'),
      route: '/resume/templates',
      // SECURITY: bypassSecurityTrustHtml is required here because Angular strips SVG from [innerHTML].
      // These are static, developer-controlled SVG strings — no user input involved.
      icon: this.sanitizer.bypassSecurityTrustHtml('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>'),
    },
  ]);

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/']);
  }
}
