import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './layout/admin-layout.component';
import { adminGuard, editorGuard } from '../../core/auth/auth.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [editorGuard],
    data: { breadcrumb: 'Admin' },
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        data: { breadcrumb: 'admin.sidebar.dashboard' },
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(
            (m) => m.ProfileComponent
          ),
        data: { breadcrumb: 'admin.profile.title' },
      },
      {
        path: 'articles',
        loadComponent: () =>
          import('./pages/articles/article-list.component').then(
            (m) => m.ArticleListComponent
          ),
        data: { breadcrumb: 'admin.sidebar.articles' },
      },
      {
        path: 'articles/new',
        loadComponent: () =>
          import('./pages/articles/article-form.component').then(
            (m) => m.ArticleFormComponent
          ),
        canDeactivate: [unsavedChangesGuard],
        data: { breadcrumb: 'admin.articleForm.newArticle' },
      },
      {
        path: 'articles/:id/edit',
        loadComponent: () =>
          import('./pages/articles/article-form.component').then(
            (m) => m.ArticleFormComponent
          ),
        canDeactivate: [unsavedChangesGuard],
        data: { breadcrumb: 'admin.articleForm.editTitle' },
      },
      {
        path: 'tags',
        loadComponent: () =>
          import('./pages/tags/tag-list.component').then(
            (m) => m.TagListComponent
          ),
        data: { breadcrumb: 'admin.sidebar.tags' },
      },
      {
        path: 'comments',
        loadComponent: () =>
          import('./pages/comments/comment-list.component').then(
            (m) => m.CommentListComponent
          ),
        data: { breadcrumb: 'admin.sidebar.comments' },
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
        loadComponent: () =>
          import('./pages/analytics/analytics.component').then(
            (m) => m.AnalyticsComponent
          ),
        data: { breadcrumb: 'admin.sidebar.analytics' },
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
        data: { breadcrumb: 'admin.sidebar.security' },
      },
    ],
  },
];
