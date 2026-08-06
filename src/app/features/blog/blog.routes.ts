import { Routes } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';

export const blogRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/article-list/article-list.component').then(
        (m) => m.ArticleListComponent
      ),
  },
  {
    path: 'tag/:slug',
    loadComponent: () =>
      import('./pages/article-list/article-list.component').then(
        (m) => m.ArticleListComponent
      ),
  },
  {
    // BUG-07: Removed duplicate search route. /search is already defined in app.routes.ts.
    // /blog/search now redirects to /search to avoid SEO ambiguity.
    path: 'search',
    redirectTo: '/search',
    pathMatch: 'full',
  },
  {
    path: ':slug',
    // provideMarkdown() scoped to this route (article-detail) instead of the root
    // config, so ngx-markdown/marked stay out of the initial bundle.
    providers: [provideMarkdown()],
    loadComponent: () =>
      import('./pages/article-detail/article-detail.component').then(
        (m) => m.ArticleDetailComponent
      ),
  },
];
