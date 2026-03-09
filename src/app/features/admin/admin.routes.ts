import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './layout/admin-layout.component';
import { authGuard, adminGuard, devGuard } from '../../core/auth/auth.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    data: { breadcrumb: 'Admin' },
    children: [
      {
        path: '',
        redirectTo: 'profile',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        canActivate: [devGuard],
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        data: { breadcrumb: 'dev.sidebar.dashboard' },
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(
            (m) => m.ProfileComponent
          ),
        data: { breadcrumb: 'account.profile.title' },
      },
      {
        path: 'articles',
        canActivate: [devGuard],
        loadComponent: () =>
          import('./pages/articles/article-list.component').then(
            (m) => m.ArticleListComponent
          ),
        data: { breadcrumb: 'dev.sidebar.articles' },
      },
      {
        path: 'articles/new',
        canActivate: [devGuard],
        loadComponent: () =>
          import('./pages/articles/article-form.component').then(
            (m) => m.ArticleFormComponent
          ),
        canDeactivate: [unsavedChangesGuard],
        data: { breadcrumb: 'dev.articleForm.newArticle' },
      },
      {
        path: 'articles/:id/edit',
        canActivate: [devGuard],
        loadComponent: () =>
          import('./pages/articles/article-form.component').then(
            (m) => m.ArticleFormComponent
          ),
        canDeactivate: [unsavedChangesGuard],
        data: { breadcrumb: 'dev.articleForm.editTitle' },
      },
      {
        path: 'tags',
        canActivate: [devGuard],
        loadComponent: () =>
          import('./pages/tags/tag-list.component').then(
            (m) => m.TagListComponent
          ),
        data: { breadcrumb: 'dev.sidebar.tags' },
      },
      {
        path: 'comments',
        canActivate: [devGuard],
        loadComponent: () =>
          import('./pages/comments/comment-list.component').then(
            (m) => m.CommentListComponent
          ),
        data: { breadcrumb: 'dev.sidebar.comments' },
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/users/user-list.component').then(
            (m) => m.UserListComponent
          ),
        data: { breadcrumb: 'admin.sidebar.users' },
      },
      {
        path: 'role-requests',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/role-requests/role-request-list.component').then(
            (m) => m.RoleRequestListComponent
          ),
        data: { breadcrumb: 'admin.sidebar.roleRequests' },
      },
      {
        path: 'analytics',
        canActivate: [devGuard],
        loadComponent: () =>
          import('./pages/analytics/analytics.component').then(
            (m) => m.AnalyticsComponent
          ),
        data: { breadcrumb: 'dev.sidebar.analytics' },
      },
      {
        path: 'newsletter',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/newsletter/newsletter.component').then(
            (m) => m.NewsletterComponent
          ),
        data: { breadcrumb: 'admin.sidebar.newsletter' },
      },
      {
        path: 'contacts',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/contacts/contact-list.component').then(
            (m) => m.ContactListComponent
          ),
        data: { breadcrumb: 'admin.sidebar.contacts' },
      },
      {
        path: 'audit',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/audit/audit.component').then(
            (m) => m.AuditComponent
          ),
        data: { breadcrumb: 'admin.sidebar.audit' },
      },
      {
        path: 'settings',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/settings/settings.component').then(
            (m) => m.SettingsComponent
          ),
        data: { breadcrumb: 'admin.sidebar.settings' },
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./pages/security/security-settings.component').then(
            (m) => m.SecuritySettingsComponent
          ),
        data: { breadcrumb: 'account.sidebar.security' },
      },
      {
        path: 'reading-history',
        loadComponent: () =>
          import('./pages/reading-history/reading-history.component').then(
            (m) => m.ReadingHistoryComponent
          ),
        data: { breadcrumb: 'account.sidebar.readingHistory' },
      },
    ],
  },
];
