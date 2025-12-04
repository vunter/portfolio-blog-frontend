import { Routes } from '@angular/router';
import { authGuard, devGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  // Public routes with layout
  {
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout/public-layout.component').then(
        (m) => m.PublicLayoutComponent
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home.component').then(
            (m) => m.HomeComponent
          ),
      },
      {
        path: 'blog',
        loadChildren: () =>
          import('./features/blog/blog.routes').then((m) => m.blogRoutes),
      },
      {
        path: 'tags',
        loadComponent: () =>
          import('./features/blog/pages/tags/tags.component').then(
            (m) => m.TagsComponent
          ),
      },
      {
        path: 'search',
        loadComponent: () =>
          import('./features/blog/pages/search/search.component').then(
            (m) => m.SearchComponent
          ),
      },
      {
        path: 'newsletter/confirm',
        loadComponent: () =>
          import(
            './features/blog/pages/newsletter-confirm/newsletter-confirm.component'
          ).then((m) => m.NewsletterConfirmComponent),
      },
      {
        path: 'newsletter/unsubscribe',
        loadComponent: () =>
          import(
            './features/blog/pages/newsletter-unsubscribe/newsletter-unsubscribe.component'
          ).then((m) => m.NewsletterUnsubscribeComponent),
      },
      {
        path: 'privacy',
        loadComponent: () =>
          import('./pages/privacy/privacy.component').then(
            (m) => m.PrivacyComponent
          ),
      },
      {
        path: 'terms',
        loadComponent: () =>
          import('./pages/terms/terms.component').then(
            (m) => m.TermsComponent
          ),
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./pages/about/about.component').then(
            (m) => m.AboutComponent
          ),
      },
    ],
  },

  // Auth routes (no layout)
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },

  // Admin routes (protected)
  {
    path: 'admin',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/admin/admin.routes').then((m) => m.adminRoutes),
  },

  // Resume routes (protected — ADMIN/DEV only, #21 VIEWER restriction)
  {
    path: 'resume',
    canActivate: [devGuard],
    loadChildren: () =>
      import('./features/resume/resume.routes').then((m) => m.resumeRoutes),
  },

  // Viewer profile routes (any authenticated user)
  {
    path: 'profile',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/viewer-profile/viewer-profile.routes').then((m) => m.viewerProfileRoutes),
  },

  // BUG-RT12: Convenience redirects for common login/register paths
  { path: 'login', redirectTo: 'auth/login', pathMatch: 'full' },
  { path: 'register', redirectTo: 'auth/register', pathMatch: 'full' },

  // 404
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(
        (m) => m.NotFoundComponent
      ),
  },
];
