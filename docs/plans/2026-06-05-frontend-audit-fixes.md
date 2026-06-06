# Frontend Audit Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix audited UI/UX and consent issues in `portfolio-blog-frontend` (functional-consent cleanup, accessibility gaps, ToC IDs, share feedback/i18n, modal focus, sidebar labels).

**Architecture:** Keep consent state authoritative in `CookieConsentService`, guard localStorage usage in `BookmarkService`, and add small a11y improvements without changing layout structure. Use a shared heading ID helper to keep ToC IDs in sync between DOM and computed list. Use Angular CDK focus trap for modal dialogs.

**Tech Stack:** Angular 20, TypeScript 5.9, RxJS 7, Angular CDK, Karma/Jasmine.

---

### Task 1: Consent cleanup + bookmark gating

**Files:**
- Modify: `src/app/core/services/cookie-consent.service.ts`
- Modify: `src/app/core/services/bookmark.service.ts`
- Test: `src/app/core/services/bookmark.service.spec.ts`

**Step 1: Write the failing test**

Add a test for functional consent denied:

```ts
it('should not load or persist bookmarks when functional consent is false', () => {
  const consentSpy = TestBed.inject(CookieConsentService) as jasmine.SpyObj<CookieConsentService>;
  consentSpy.hasConsent.and.returnValue(false);

  const fresh = TestBed.inject(BookmarkService);
  expect(fresh.bookmarks().size).toBe(0);

  fresh.toggle('no-consent');
  expect(localStorage.getItem('bookmarked-articles')).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --include=src/app/core/services/bookmark.service.spec.ts`  
Expected: FAIL (service reads/persists without consent).

**Step 3: Write minimal implementation**

Update `clearFunctionalStorage` to clear correct keys and prefixes:

```ts
private clearFunctionalStorage(): void {
  const functionalKeys = [
    'app-theme',
    'app-language',
    'bookmarked-articles',
    'visitor-id',
    'supported-languages',
  ];
  for (const key of functionalKeys) localStorage.removeItem(key);
  // Clear cached translations
  Object.keys(localStorage).filter(k => k.startsWith('i18n-')).forEach(k => localStorage.removeItem(k));
}
```

Guard bookmark load/persist and clear on consent revoke:

```ts
readonly bookmarks = signal<Set<string>>(this.loadBookmarks());

constructor() {
  effect(() => {
    if (!this.consent.hasConsent('functional')) {
      this.bookmarks.set(new Set());
    }
  });
}

private loadBookmarks(): Set<string> {
  if (!isPlatformBrowser(this.platformId) || !this.consent.hasConsent('functional')) {
    return new Set();
  }
  ...
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --include=src/app/core/services/bookmark.service.spec.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/core/services/cookie-consent.service.ts \
  src/app/core/services/bookmark.service.ts \
  src/app/core/services/bookmark.service.spec.ts
git commit -m "fix: gate bookmarks behind functional consent" -m "" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Keyboard access for toast + article card

**Files:**
- Modify: `src/app/shared/components/toast/toast.component.html`
- Modify: `src/app/shared/components/toast/toast.component.ts`
- Modify: `src/app/shared/components/article-card/article-card.component.html`
- Modify: `src/app/shared/components/article-card/article-card.component.ts`

**Step 1: Write the failing test**

Manual check only (no existing component tests).

**Step 2: Implement minimal changes**

Toast (focusable + keyboard):

```html
<div
  ...
  [attr.tabindex]="notification.route ? 0 : null"
  (keydown.enter)="onToastClick(notification)"
  (keydown.space)="onToastKeydown($event, notification)"
>
```

```ts
onToastKeydown(event: KeyboardEvent, notification: Notification): void {
  if (event.code === 'Space') {
    event.preventDefault();
    this.onToastClick(notification);
  }
}
```

Article card (space key):

```html
<article ... (keydown.enter)="navigateToArticle()" (keydown.space)="onCardKeydown($event)">
```

```ts
onCardKeydown(event: KeyboardEvent): void {
  if (event.code === 'Space') {
    event.preventDefault();
    this.navigateToArticle();
  }
}
```

**Step 3: Manual verification**

Navigate to any article list and verify:
- Toasts with routes can be focused and activated with Enter/Space.
- Article card activates with Space without page scroll.

**Step 4: Commit**

```bash
git add src/app/shared/components/toast/toast.component.html \
  src/app/shared/components/toast/toast.component.ts \
  src/app/shared/components/article-card/article-card.component.html \
  src/app/shared/components/article-card/article-card.component.ts
git commit -m "fix: improve keyboard access for cards and toasts" -m "" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Unique heading IDs for ToC

**Files:**
- Create: `src/app/shared/utils/heading-id.utils.ts`
- Modify: `src/app/features/blog/pages/article-detail/services/content-processor.service.ts`
- Modify: `src/app/features/blog/pages/article-detail/article-detail.component.ts`
- Test: `src/app/shared/utils/heading-id.utils.spec.ts`

**Step 1: Write the failing test**

```ts
import { buildHeadingId } from './heading-id.utils';

it('should dedupe duplicate headings', () => {
  const used = new Map<string, number>();
  expect(buildHeadingId('Intro', used)).toBe('intro');
  expect(buildHeadingId('Intro', used)).toBe('intro-2');
  expect(buildHeadingId('Intro', used)).toBe('intro-3');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --include=src/app/shared/utils/heading-id.utils.spec.ts`  
Expected: FAIL (helper missing).

**Step 3: Write minimal implementation**

```ts
// heading-id.utils.ts
export function buildHeadingId(text: string, used: Map<string, number>): string {
  const base = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  const count = (used.get(base) ?? 0) + 1;
  used.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}
```

Use the helper in both heading processors with a shared map:

```ts
const used = new Map<string, number>();
headings.forEach((h) => {
  const id = buildHeadingId((h.textContent || '').trim(), used);
  renderer.setAttribute(h, 'id', id);
});
```

```ts
const used = new Map<string, number>();
...
const id = buildHeadingId(text, used);
items.push({ id, text, level });
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --include=src/app/shared/utils/heading-id.utils.spec.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/shared/utils/heading-id.utils.ts \
  src/app/shared/utils/heading-id.utils.spec.ts \
  src/app/features/blog/pages/article-detail/services/content-processor.service.ts \
  src/app/features/blog/pages/article-detail/article-detail.component.ts
git commit -m "fix: dedupe heading ids for toc" -m "" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 4: Share feedback + i18n labels

**Files:**
- Modify: `src/app/features/blog/pages/article-detail/utils/share.util.ts`
- Modify: `src/app/features/blog/pages/article-detail/article-detail.component.html`
- Modify: `src/app/core/services/i18n/en.ts`
- Modify: `src/app/core/services/i18n/pt-br.ts`
- Modify: `src/app/core/services/i18n/es.ts`
- Modify: `src/app/core/services/i18n/it.ts`
- Modify: `src/app/core/services/i18n/en_extracted.json`

**Step 1: Write the failing test**

Manual check only (no unit tests for share utils).

**Step 2: Implement minimal changes**

Update native share fallback:

```ts
} else {
  navigator.clipboard.writeText(shareUrl)
    .then(() => ctx.notification.success(ctx.i18n.t('blog.linkCopied')))
    .catch(() => ctx.notification.error(ctx.i18n.t('common.error')));
  ctx.articleService.trackShare(article?.id ? +article.id : undefined, 'native');
}
```

Replace hard-coded labels with i18n:

```html
<button ... [title]="i18n.t('blog.shareTwitter')" [attr.aria-label]="i18n.t('blog.shareTwitter')">
...
<button ... [title]="i18n.t('blog.shareLinkedIn')" [attr.aria-label]="i18n.t('blog.shareLinkedIn')">
...
<button ... [title]="i18n.t('blog.shareFacebook')" [attr.aria-label]="i18n.t('blog.shareFacebook')">
```

Add translation keys in all locale files:

```
blog.shareTwitter=Share on Twitter
blog.shareLinkedIn=Share on LinkedIn
blog.shareFacebook=Share on Facebook
```

**Step 3: Manual verification**

Check share buttons show translated labels and clipboard fallback shows success/error correctly.

**Step 4: Commit**

```bash
git add src/app/features/blog/pages/article-detail/utils/share.util.ts \
  src/app/features/blog/pages/article-detail/article-detail.component.html \
  src/app/core/services/i18n/en.ts \
  src/app/core/services/i18n/pt-br.ts \
  src/app/core/services/i18n/es.ts \
  src/app/core/services/i18n/it.ts \
  src/app/core/services/i18n/en_extracted.json
git commit -m "fix: share labels and clipboard feedback" -m "" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5: Modal focus + sidebar labels

**Files:**
- Modify: `src/app/layouts/public-layout/public-layout.component.html`
- Modify: `src/app/layouts/public-layout/public-layout.component.ts`
- Modify: `src/app/shared/components/cookie-consent/cookie-consent.component.html`
- Modify: `src/app/shared/components/cookie-consent/cookie-consent.component.ts`
- Modify: `src/app/features/viewer-profile/layout/viewer-profile-layout.component.ts`
- Modify: `src/app/core/services/i18n/en.ts`
- Modify: `src/app/core/services/i18n/pt-br.ts`
- Modify: `src/app/core/services/i18n/es.ts`
- Modify: `src/app/core/services/i18n/it.ts`

**Step 1: Write the failing test**

Manual check only (no existing component tests).

**Step 2: Implement minimal changes**

Use Angular CDK focus trap for dialogs:

```ts
import { CdkTrapFocus } from '@angular/cdk/a11y';
...
imports: [..., CdkTrapFocus]
```

```html
<div class="mobile-menu" role="dialog" aria-modal="true" cdkTrapFocus>
  <button class="mobile-menu-close" cdkFocusInitial ...>
```

```html
<div class="cookie-banner" role="dialog" aria-modal="true" cdkTrapFocus>
  <button class="btn btn-primary" cdkFocusInitial ...>
```

Add Escape handling in `PublicLayoutComponent` and `CookieConsentComponent`:

```ts
@HostListener('document:keydown', ['$event'])
onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && this.mobileMenuOpen()) this.closeMobileMenu();
}
```

Add `aria-label` on sidebar toggle buttons:

```html
<button ... [attr.aria-label]="i18n.t('viewer.sidebar.collapse')">
```

Add i18n keys:

```
viewer.sidebar.collapse=Collapse sidebar
viewer.sidebar.expand=Expand sidebar
```

**Step 3: Manual verification**

- When mobile menu opens, focus is trapped and Escape closes it.
- Cookie banner traps focus and initial focus is on the primary action.
- Sidebar toggle buttons announce correctly in screen readers.

**Step 4: Commit**

```bash
git add src/app/layouts/public-layout/public-layout.component.html \
  src/app/layouts/public-layout/public-layout.component.ts \
  src/app/shared/components/cookie-consent/cookie-consent.component.html \
  src/app/shared/components/cookie-consent/cookie-consent.component.ts \
  src/app/features/viewer-profile/layout/viewer-profile-layout.component.ts \
  src/app/core/services/i18n/en.ts \
  src/app/core/services/i18n/pt-br.ts \
  src/app/core/services/i18n/es.ts \
  src/app/core/services/i18n/it.ts
git commit -m "fix: improve modal focus and labels" -m "" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
