# Frontend Architecture

## High-Level Overview

```mermaid
graph TB
    subgraph Client["Browser"]
        APP["Angular 20 SSR App"]
    end

    subgraph Backend["Spring Boot API"]
        API["/api/v1/*"]
        AUTH["/api/v1/auth/*"]
        I18N["/api/v1/i18n/{locale}"]
        SEARCH["/api/v1/articles/search"]
    end

    subgraph External["External Services"]
        SENTRY["Sentry (Error Monitoring)"]
        RECAPTCHA["Google reCAPTCHA v3"]
    end

    APP -->|HTTP + JWT| API
    APP -->|Auth flows| AUTH
    APP -->|Translations| I18N
    APP -->|FTS queries| SEARCH
    APP -.->|Error reports| SENTRY
    APP -.->|Bot protection| RECAPTCHA
```

## Module Architecture

```mermaid
graph LR
    subgraph Core["core/"]
        AUTH_STORE["AuthStore (signal-based)"]
        GUARDS["Guards (auth, role, dev)"]
        INTERCEPTORS["Interceptors (JWT, error)"]
        SERVICES["Services (API, i18n, theme, SEO, analytics, cookie-consent, notification)"]
    end

    subgraph Features["features/"]
        BLOG["blog/ (articles, search, tags)"]
        ADMIN["admin/ (dashboard, articles, comments, settings, users)"]
        RESUME["resume/ (profile, generate, templates, editor)"]
        HOME["home/ (landing page, sections)"]
        AUTH_FEAT["auth/ (login, register, verify, MFA)"]
        VIEWER["viewer-profile/ (public profile)"]
    end

    subgraph Shared["shared/"]
        COMPONENTS["Components (article-card, breadcrumbs, cookie-consent, confirm-dialog, pagination, skeleton, toast, theme-toggle)"]
        UTILS["Utils (string, throttle-click)"]
        TYPES["Types (monaco.d.ts)"]
    end

    Features -->|inject| Core
    Features -->|use| Shared
    Core -->|provides| SERVICES
```

## Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Component
    participant S as Service
    participant API as Backend API
    participant LS as localStorage

    U->>C: Interaction (click, navigate)
    C->>S: Call service method
    S->>API: HTTP request (with JWT via interceptor)
    API-->>S: JSON response
    S-->>C: Signal update
    C-->>U: Re-render (OnPush CD)

    Note over S,LS: Caching layer
    S->>LS: Cache translations (24h TTL)
    S->>LS: Cache supported languages (1h TTL)
    S->>LS: Persist theme/language (if consent)
```

## Authentication Flow

```mermaid
graph TD
    A[User visits page] --> B{Has JWT?}
    B -->|No| C[Public content only]
    B -->|Yes| D{Token expired?}
    D -->|No| E[Authenticated access]
    D -->|Yes| F[Refresh token flow]
    F --> G{Refresh success?}
    G -->|Yes| E
    G -->|No| H[Redirect to login]

    E --> I{Role check}
    I -->|ADMIN| J[Full admin panel]
    I -->|DEV/EDITOR| K[Content management]
    I -->|VIEWER| L[Comments + bookmarks]
```

## Feature Breakdown

### Blog Module
- **Article list** with pagination, tag filtering, search
- **Article detail** with ToC, reading progress, comments (extracted to `ArticleCommentsComponent`), social sharing, related articles
- **Search** with server-side PostgreSQL FTS, cross-language support via `'simple'` config
- **Tags** with tag cloud and per-tag article listing

### Admin Module
- **Dashboard** with analytics summary
- **Article management** with Monaco editor, auto-save, version history, translations, review workflow
- **Comment moderation** with server-side search
- **User management** with role assignment
- **Settings** with import/export (JSON validation + XSS sanitization)
- **Newsletter** management

### Resume Module
- **Profile editor** with sections (experience, education, skills, projects, languages, testimonials)
- **HTML/PDF generation** with language selection
- **Template editor** with Monaco (HTML+CSS), live preview, snippet insertion
- **Template management** (list, create, update, set default)

## Key Patterns

| Pattern | Implementation |
|---------|---------------|
| State management | Signal-based (`signal()`, `computed()`, `effect()`) |
| Change detection | `OnPush` everywhere |
| Auth state | `AuthStore` with signals, no NgRx |
| i18n | DB-driven, English bundled, others fetched + cached |
| Error handling | `GlobalErrorHandler` → Sentry + backend reporting |
| Cookie consent | 3-tier (necessary/functional/analytics) with degradation UX |
| Analytics | First-party only, consent-gated, scroll depth + time-on-page |
| Code editor | Monaco (lazy-loaded via `MonacoLoaderService`) |
| Forms | Reactive (`FormBuilder`) for complex forms, template-driven for simple |
| API calls | `ApiService` wrapper with typed methods + JWT interceptor |

## Build & CI

```mermaid
graph LR
    A[Push/PR] --> B[CI Pipeline]
    B --> C[Lint - ng lint]
    B --> D[Build - ng build]
    B --> E[Generate SBOM - CycloneDX]
    C --> F{Errors?}
    F -->|Yes| G[Fail]
    F -->|No| H[Pass]
    D --> H
    E --> I[Upload SBOM artifact]
```
