import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, ActivatedRoute, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { ThemeService } from '../../../core/services/theme.service';
import { I18nService } from '../../../core/services/i18n.service';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { BreadcrumbsComponent, Breadcrumb } from '../../../shared/components/breadcrumbs/breadcrumbs.component';
import { RealtimeNotificationService } from '../services/realtime-notification.service';
import { SafeIconPipe } from '../pipes/safe-icon.pipe';

import { NotificationBellComponent } from '../components/notification-bell/notification-bell.component';

// Breadcrumbs are built dynamically from route data (see breadcrumbs computed signal below)

/**
 * SEC-05: Refactored MenuItem to use string icon names instead of SafeHtml.
 * Icons are resolved by the SafeIconPipe from a static registry,
 * preventing potential XSS if icon sources ever become dynamic.
 */
interface MenuItem {
  label: string;
  icon: string;
  route: string;
  adminOnly?: boolean;
  devOnly?: boolean;
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent, BreadcrumbsComponent, SafeIconPipe, NotificationBellComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  readonly authStore = inject(AuthStore);
  readonly themeService = inject(ThemeService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly realtimeNotifications = inject(RealtimeNotificationService);
  sidebarCollapsed = signal(false);
  // INC-03: Expose connectionLost signal for reconnection UI
  readonly connectionLost = this.realtimeNotifications.connectionLost;

  /** FEAT-07: Build breadcrumbs from route data */
  private navigationEnd = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null)
    )
  );

  breadcrumbs = computed<Breadcrumb[]>(() => {
    this.navigationEnd(); // trigger recomputation on navigation
    this.i18n.language(); // trigger recomputation on language change
    const crumbs: Breadcrumb[] = [{ label: this.authStore.isAdmin() ? 'Admin' : (this.authStore.user()?.name || 'Dashboard'), route: '/admin' }];
    let route = this.activatedRoute.firstChild;
    let url = '/admin';
    while (route) {
      const breadcrumbKey = route.snapshot.data['breadcrumb'];
      if (breadcrumbKey) {
        const segment = route.snapshot.url.map(s => s.path).join('/');
        if (segment) url += `/${segment}`;
        crumbs.push({ label: this.i18n.t(breadcrumbKey), route: url });
      }
      route = route.firstChild;
    }
    return crumbs;
  });

  ngOnInit(): void {
    this.realtimeNotifications.connect();
  }

  ngOnDestroy(): void {
    this.realtimeNotifications.disconnect();
  }

  // MED-01: computed() signal instead of getter for menu items
  readonly menuItems = computed<MenuItem[]>(() => [
    {
      label: this.i18n.t('account.profile.title'),
      route: '/admin/profile',
      icon: 'profile',
    },
    {
      label: this.i18n.t('dev.sidebar.dashboard'),
      route: '/admin/dashboard',
      icon: 'dashboard',
      devOnly: true,
    },
    {
      label: this.i18n.t('dev.sidebar.articles'),
      route: '/admin/articles',
      icon: 'articles',
      devOnly: true,
    },
    {
      label: this.i18n.t('dev.sidebar.resumes'),
      route: '/resume/templates',
      icon: 'resumes',
      devOnly: true,
    },
    {
      label: this.i18n.t('dev.sidebar.tags'),
      route: '/admin/tags',
      icon: 'tags',
      devOnly: true,
    },
    {
      label: this.i18n.t('dev.sidebar.comments'),
      route: '/admin/comments',
      icon: 'comments',
      devOnly: true,
    },
    {
      label: this.i18n.t('admin.sidebar.users'),
      route: '/admin/users',
      adminOnly: true,
      icon: 'users',
    },
    {
      label: this.i18n.t('admin.sidebar.roleRequests'),
      route: '/admin/role-requests',
      adminOnly: true,
      icon: 'roleRequests',
    },
    {
      label: this.i18n.t('dev.sidebar.analytics'),
      route: '/admin/analytics',
      icon: 'analytics',
      devOnly: true,
    },
    {
      label: this.i18n.t('admin.sidebar.newsletter'),
      route: '/admin/newsletter',
      adminOnly: true,
      icon: 'newsletter',
    },
    {
      label: this.i18n.t('admin.sidebar.contacts'),
      route: '/admin/contacts',
      adminOnly: true,
      icon: 'contacts',
    },
    {
      label: this.i18n.t('admin.sidebar.settings'),
      route: '/admin/settings',
      adminOnly: true,
      icon: 'settings',
    },
    {
      label: this.i18n.t('account.sidebar.security'),
      route: '/admin/security',
      icon: 'security',
    },
    {
      label: this.i18n.t('account.sidebar.readingHistory'),
      route: '/admin/reading-history',
      icon: 'readingHistory',
    },
  ]);

  readonly visibleMenuItems = computed(() => {
    const isAdmin = this.authStore.isAdmin();
    const isDev = this.authStore.isDev();
    return this.menuItems().filter(item => {
      if (item.adminOnly && !isAdmin) return false;
      if (item.devOnly && !isDev) return false;
      return true;
    });
  });

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/']);
  }

  // INC-03: Reconnect realtime notifications
  reconnect(): void {
    this.realtimeNotifications.connect();
  }
}
