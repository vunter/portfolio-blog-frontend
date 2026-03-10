import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { ThemeService } from '../../../core/services/theme.service';
import { I18nService } from '../../../core/services/i18n.service';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-viewer-profile-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent],
  template: `
    <div class="viewer-layout" [class.sidebar-collapsed]="sidebarCollapsed()">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <a routerLink="/" class="logo-link">
            @if (sidebarCollapsed()) {
              <img src="images/favicon.svg" alt="C" class="logo-icon" />
            } @else {
              <img src="images/logo-simplified.svg" [alt]="i18n.t('common.appName')" class="logo-full" />
            }
          </a>
          @if (!sidebarCollapsed()) {
            <button class="toggle-btn" (click)="toggleSidebar()" title="Collapse">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          }
        </div>

        @if (sidebarCollapsed()) {
          <button class="toggle-btn expand-btn" (click)="toggleSidebar()" title="Expand">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        }

        <nav class="sidebar-nav">
          <a routerLink="/profile" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span class="nav-label" [class.hidden]="sidebarCollapsed()">{{ i18n.t('viewer.sidebar.myProfile') }}</span>
          </a>

          <a routerLink="/profile/security" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span class="nav-label" [class.hidden]="sidebarCollapsed()">{{ i18n.t('viewer.sidebar.security') }}</span>
          </a>

          <a routerLink="/profile/reading-history" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            <span class="nav-label" [class.hidden]="sidebarCollapsed()">{{ i18n.t('viewer.sidebar.readingHistory') }}</span>
          </a>

          @if (authStore.isDev()) {
          <div class="nav-divider"></div>
          <a routerLink="/admin/dashboard" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            <span class="nav-label" [class.hidden]="sidebarCollapsed()">{{ i18n.t('viewer.sidebar.dashboard') }}</span>
          </a>
          <a routerLink="/admin/articles" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span class="nav-label" [class.hidden]="sidebarCollapsed()">{{ i18n.t('viewer.sidebar.articles') }}</span>
          </a>
          <a routerLink="/admin/comments" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="nav-label" [class.hidden]="sidebarCollapsed()">{{ i18n.t('viewer.sidebar.comments') }}</span>
          </a>
          }

          @if (authStore.isDev()) {
          <a routerLink="/resume/templates" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span class="nav-label" [class.hidden]="sidebarCollapsed()">{{ i18n.t('viewer.sidebar.resume') }}</span>
          </a>
          }
        </nav>

        <div class="sidebar-footer">
          <a routerLink="/" class="footer-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            <span [class.hidden]="sidebarCollapsed()">{{ i18n.t('account.sidebar.backToSite') }}</span>
          </a>

          @if (!sidebarCollapsed()) {
            <app-theme-toggle />
          }

          <div class="user-info" [class.hidden]="sidebarCollapsed()">
            <span class="user-name">{{ authStore.userDisplayName() }}</span>
            <span class="user-role">{{ authStore.user()?.role }}</span>
          </div>

          <button class="footer-link logout-btn" (click)="logout()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span [class.hidden]="sidebarCollapsed()">{{ i18n.t('account.sidebar.logout') }}</span>
          </button>
        </div>
      </aside>

      <!-- Main content -->
      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
  styleUrl: './viewer-profile-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerProfileLayoutComponent {
  readonly authStore = inject(AuthStore);
  readonly themeService = inject(ThemeService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  sidebarCollapsed = signal(false);

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/']);
  }
}
