# Frontend Audit Fixes Design

## Goal

Fix the audited frontend issues with a shared, low-risk approach:

- gate functional storage behind consent
- dedupe heading IDs for article ToC
- improve keyboard access and dialog focus handling
- make share feedback and labels fully i18n/a11y friendly
- apply nearby UX polish where it is tightly coupled to those flows

## Design

### 1. Consent-safe storage

Keep `CookieConsentService` as the source of truth for functional consent. `BookmarkService` should not read or persist bookmarks when functional consent is disabled, and should clear in-memory state when consent is revoked.

I will also normalize the storage cleanup list so theme/language/bookmark-related keys are cleared consistently, including `i18n-*` cached entries.

### 2. Shared heading ID helper

Create one helper for slugging headings and de-duplicating IDs. Use the same helper in both:

- rendered article content
- computed table-of-contents entries

This keeps DOM IDs and ToC anchors in sync and avoids duplicate IDs when headings repeat.

### 3. Shared UI accessibility updates

Apply small, local changes to:

- toast actions
- article cards
- confirm dialogs / modals
- cookie-consent / terms flows where focus is trapped

The goal is keyboard activation, Escape-to-close behavior, and clearer accessible labels without changing the layout structure.

### 4. Share feedback and labels

Make the share fallback show explicit success/failure feedback and move any hard-coded labels into the i18n dictionary. Keep native share and clipboard fallback behavior unchanged, just more accessible and user-visible.

## Error handling

- If consent is disabled, storage reads return empty state and writes become no-ops.
- If share or clipboard fallback fails, show a localized error instead of silently swallowing it.
- If heading processing encounters duplicates, it should deterministically suffix IDs rather than failing.

## Testing

- Add/extend unit tests for bookmark consent gating.
- Add a helper test for heading ID de-duplication.
- Reuse existing component/service tests where possible for toast, article card, and share behavior.

## Outcome

This keeps the frontend changes localized, keeps the existing layout intact, and fixes the highest-impact audit issues first while still allowing adjacent a11y/i18n cleanup where it is directly connected.
