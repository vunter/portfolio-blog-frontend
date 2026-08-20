import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * INERT AS DEPLOYED. angular.json names a `server` entry point but sets no
 * `outputMode`/`ssr`, so the production build emits only `dist/frontend/browser`
 * plus an empty prerendered-routes.json, and the container serves those files
 * from nginx with no Node runtime. Every RenderMode below is therefore unused:
 * the app ships as a pure SPA and none of these pages is server-rendered.
 *
 * The file is kept because the render modes are correct for the day SSR (or
 * static prerendering, the cheaper option here — it needs no Node process, only
 * an outputMode change and a Dockerfile copy) is actually turned on. Until then,
 * do not read this as evidence that a route is indexed as server-rendered HTML.
 */
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
  // AUD18-LOW8: /cookies is a public legal page like privacy/terms — SSR it.
  // Component is SSR-safe: window access only inside a click handler and
  // CookieConsentService guards storage access with isPlatformBrowser.
  {
    path: 'cookies',
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
