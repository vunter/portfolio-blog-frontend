import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Server,
  },
  {
    path: 'blog',
    renderMode: RenderMode.Server,
  },
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'blog/tag/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'about',
    renderMode: RenderMode.Server,
  },
  {
    path: 'privacy',
    renderMode: RenderMode.Server,
  },
  {
    path: 'terms',
    renderMode: RenderMode.Server,
  },
  {
    path: 'tags',
    renderMode: RenderMode.Server,
  },
  {
    path: 'search',
    renderMode: RenderMode.Client,
  },
  {
    path: 'newsletter/confirm',
    renderMode: RenderMode.Client,
  },
  {
    path: 'newsletter/unsubscribe',
    renderMode: RenderMode.Client,
  },
  {
    path: 'auth/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'resume/**',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
