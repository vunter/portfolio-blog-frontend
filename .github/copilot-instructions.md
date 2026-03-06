# Portfolio Blog Frontend — Copilot Instructions

## Build & Run

```bash
# Install dependencies
npm ci

# Dev server (proxies /api to localhost:8080, /cdn to cdn.catananti.dev)
ng serve

# Production build (what CI runs)
npx ng build --configuration=production

# Unit tests (Karma + Jasmine)
ng test

# Run a single test file
ng test --include=src/app/core/services/i18n.service.spec.ts

# E2e tests (Playwright, requires backend on :8080 and ng serve on :4200)
npx playwright test

# Run a single e2e suite
npx playwright test e2e/auth.spec.ts

# Run a single e2e test by name
npx playwright test -g "should login successfully"

# Format code
npx prettier --write "src/**/*.{ts,html,scss}"
```

## Architecture

**Angular 20** standalone-component SPA with NgRx Signal Store for state management, served via nginx in production with Angular Service Worker for offline caching.

### Request Flow (Production)

```
Browser → Cloudflare → Nginx (SSL) → Angular SPA (nginx :4000)
                                   → /api/* proxied to Spring Boot API (:8080)
                                   → /cdn/* proxied to Cloudflare R2
```

### HTTP Interceptor Chain (order matters)
1. `progressInterceptor` — start/complete counter for top loading bar
2. `tokenInterceptor` — adds `withCredentials: true` + `Accept-Language` header (reads lang from localStorage directly, **not** from I18nService)
3. `refreshTokenInterceptor` — catches 401, refreshes JWT, retries original request
4. `errorInterceptor` — global error notification via toast/snackbar

### Module Structure
```
src/app/
├── core/           # Singletons: AuthStore, services, interceptors, guards
├── features/       # Lazy-loaded routes: admin, auth, blog, home, resume, viewer-profile
├── shared/         # Reusable components (18+), types, utils
├── models/         # Domain types (exported from index.ts barrel)
├── layouts/        # Page layout wrappers (PublicLayout)
└── pages/          # Static pages: about, privacy, terms, not-found
```

### Routing
- Public routes wrapped in `PublicLayoutComponent` (home, blog, tags, search)
- Auth routes (`/auth/login`, `/auth/register`) — no layout wrapper
- Admin routes — protected by `authGuard`
- Resume feature — protected by `devGuard` (dev/admin only)
- Redirects: `/login` → `/auth/login`, `/register` → `/auth/register`
- **All feature routes use `loadComponent`** — lazy loading is mandatory

## Key Conventions

### Components
- **Always standalone** — no NgModules. List all deps in `imports: [...]`
- **`ChangeDetectionStrategy.OnPush`** on every component
- **`inject()` function** for DI — never constructor injection
- **Signal-based inputs**: `input()` / `input.required()` instead of `@Input()`
- **Separate template/style files**: `templateUrl` + `styleUrl` (not inline)
- **Component prefix**: `app-` (enforced in `angular.json`)
- **Cleanup**: Use `takeUntilDestroyed()` for subscriptions — no manual `unsubscribe()`

### State Management (NgRx Signal Store)
```typescript
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({ user: null, isAuthenticated: false, ... }),
  withComputed((store) => ({
    isAdmin: computed(() => store.user()?.role === 'ADMIN'),
  })),
  withMethods((store) => ({
    login(user: User) { patchState(store, { user, isAuthenticated: true }); },
  })),
);
```
- State + computed + methods in one file
- Methods call `patchState()` — never mutate state directly
- Storage sync (localStorage) handled inside store methods via `StorageService`

### Services
- One responsibility per service, `providedIn: 'root'`
- API calls through `ApiService` — base URL built from `environment.apiUrl + '/' + environment.apiVersion`
- Retry strategy: network errors (status 0) and 5xx retry with backoff; 4xx fail immediately
- File uploads via separate `upload()` method using `FormData`

### Guards
- `authGuard` — requires authenticated user
- `devGuard` — requires `DEV` or `ADMIN` role
- `adminGuard` — requires `ADMIN` role
- `unsavedChangesGuard` — CanDeactivate: component **must** implement `HasUnsavedChanges` interface with `hasUnsavedChanges: boolean` property, uses `ConfirmDialogService` + i18n

### Notification System
- Signal-based notification service: `success()`, `error()`, `warning()`, `info()`
- Default durations: 5s (success/warning/info), 8s (error)
- Auto-dismiss by ID; no manual cleanup needed

### i18n
- English translations bundled inline as fallback constant
- Other locales fetched from backend: `GET /api/v1/i18n/{locale}`
- Translations are **role-aware** — response varies by auth tier (public/viewer/dev/admin)
- Cached in localStorage with 24h TTL; cache invalidates on auth state change
- All user-facing strings use `i18n.t('key')` — never hardcode text
- **Critical**: `I18nService` uses `HttpBackend` directly for bootstrap `/api/v1/languages` request to avoid circular dependency with interceptors

### Theme System
- CSS custom properties (`var(--*)`) — **never hardcode colors**
- Storage key: `app-theme` in localStorage (requires "functional" cookie consent)
- Cycle: auto → light → dark → auto (system detection via `matchMedia('(prefers-color-scheme: dark)')`)
- Applied via `data-theme` attribute on `<html>` + `.theme-{light|dark}` class on `<body>`
- Respects `CookieConsentService` for localStorage access

### Global Styles Architecture
Modular SCSS with 15 partials in `src/styles/`:
- `_variables.scss`: 226 CSS custom properties (design tokens)
- `_themes.scss`: Dark & light theme overrides (230+ vars per theme)
- `_breakpoints.scss`, `_accessibility.scss`, `_animations.scss`, etc.

Key design tokens (light theme):
- Colors: primary `#3b82f6`, semantic success/error/warning/info
- Typography: Inter / JetBrains Mono, 8 font sizes
- Spacing: xs–2xl (0.25rem–3rem)
- Z-index scale: 1000–1080 (dropdown → toast)
- Layout: 64px header, 260px sidebar, 1200px max-width

### Shared Components (18+)
`toast`, `pagination`, `confirm-dialog`, `multi-select`, `media-upload`, `skeleton`, `theme-toggle`, `breadcrumbs`, `contact-form`, `empty-state`, `article-card`, `cookie-consent`, `newsletter-subscribe`, `loading-spinner`, `media-library`, `safe-icon-pipe`

### Environment Configuration
```typescript
// environments/environment.ts (dev)
export const environment = {
  apiUrl: '/api',        // Proxied by ng serve → localhost:8080
  apiVersion: 'v1',
  ownerAlias: 'admin',   // Dev profile alias
  siteUrl: 'http://localhost:4200',
};

// environments/environment.prod.ts
export const environment = {
  apiUrl: '/api',        // Same-origin, proxied by nginx
  apiVersion: 'v1',
  ownerAlias: 'leonardo-catananti',
  siteUrl: 'https://catananti.dev',
};
```

### Dev Proxy (`proxy.conf.json`)
- `/api` → `http://localhost:8080` (backend)
- `/cdn` → `https://cdn.catananti.dev` (R2 CDN, with path rewrite and origin change)

### Service Worker (`ngsw-config.json`)
- App shell prefetched (HTML, JS, CSS)
- Font/image assets lazy-loaded
- API data groups use **freshness strategy** (10min TTL) for articles, tags, profile
- Admin/auth API routes are **network-only** (never cached)
- Google Fonts use **performance strategy** (365-day cache)

### Testing
- **Unit tests**: Karma + Jasmine, `ng test`
- **E2e tests**: Playwright with 14 spec files
  - Single worker, sequential execution, 30s timeout, 2 retries in CI
  - Base URL: `http://localhost:4200`, API base: `http://localhost:4200/api/v1`
  - Helpers: `loginViaUI()` (human-like 30ms typing), `dismissCookieConsent()` (pre-set localStorage), `seedTestUsers()` (API-based)
  - Screenshots/traces captured on first retry for debugging

### Code Style
- Prettier: 100-char line width, single quotes, Angular HTML parser, trailing commas (all)
- No explicit path aliases in tsconfig — use relative imports
- Barrel exports from `models/index.ts`

## Build Budgets (CI enforced)

| Type | Warning | Error |
|------|---------|-------|
| Initial bundle | 500kB | 1MB |
| Component styles | 20kB | 32kB |

Exceeding the error threshold **fails CI**. Lazy-load feature routes and avoid importing heavy modules in `core/`.

## CI/CD

- **CI** (`ci.yml`): triggers on push/PR to `main`/`develop` — `npm ci` → `npx ng build --configuration=production` → Docker build + push to GHCR
- **Node version**: 22

## Deployment

- **Docker**: Multi-stage — `node:22-alpine` (build) → `nginx:1.27-alpine` (serve on port 4000)
- **Nginx config**: SPA fallback (`try_files $uri $uri/ /index.html`), gzip, 1-year immutable cache for hashed assets, security headers (nosniff, SAMEORIGIN)
- **Non-root container**: runs as `nginx:nginx` user

## Known Gotchas

- **Interceptor circular dependency**: `I18nService` must use `HttpBackend` (not `HttpClient`) for its bootstrap language fetch — otherwise the interceptor chain creates a circular DI loop through `AuthStore → I18nService`
- **Token interceptor reads localStorage directly** (`app-language` key) instead of injecting `I18nService` to avoid the same circular dependency
- **Never use bare `.subscribe()`** — always use `takeUntilDestroyed()` or handle completion. Bare subscribes leak memory.
- **Service Worker caching**: After deploying new code, the SW serves the old cached bundle until it detects the updated `ngsw.json`. Clear SW caches for immediate testing.
- **Cookie consent gates localStorage**: Theme preferences and analytics only write to localStorage after user accepts "functional" cookies via `CookieConsentService`
- **SafeIconPipe**: Use this instead of `bypassSecurityTrustHtml` for SVG icons — it's the project's standard for safe HTML rendering
