import { Component, Input, computed, signal, ChangeDetectionStrategy } from '@angular/core';

/**
 * Q7.5: Google SERP preview — shows how the article will appear in search results.
 * Highlights when title exceeds ~60 chars or description exceeds ~160 chars.
 */
@Component({
  selector: 'app-seo-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seo-preview">
      <div class="seo-preview__header">SEO Preview</div>
      <div class="seo-preview__result">
        <div class="seo-preview__url">{{ displayUrl() }}</div>
        <div class="seo-preview__title" [class.seo-preview__title--truncated]="titleTruncated()">
          {{ displayTitle() }}
        </div>
        <div class="seo-preview__description" [class.seo-preview__description--truncated]="descriptionTruncated()">
          {{ displayDescription() }}
        </div>
      </div>
      <div class="seo-preview__counters">
        <span [class.over]="titleTruncated()">Title: {{ titleLength() }}/60</span>
        <span [class.over]="descriptionTruncated()">Description: {{ descriptionLength() }}/160</span>
      </div>
    </div>
  `,
  styles: [`
    .seo-preview { border: 1px solid var(--border-color, #ddd); border-radius: 8px; padding: 16px; margin: 12px 0; background: var(--surface-color, #fff); }
    .seo-preview__header { font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted, #666); margin-bottom: 8px; }
    .seo-preview__url { font-size: 12px; color: #202124; margin-bottom: 2px; }
    .seo-preview__title { font-size: 18px; color: #1a0dab; line-height: 1.3; margin-bottom: 4px; cursor: pointer; }
    .seo-preview__title:hover { text-decoration: underline; }
    .seo-preview__title--truncated { color: #d93025; }
    .seo-preview__description { font-size: 13px; color: #4d5156; line-height: 1.5; }
    .seo-preview__description--truncated { color: #d93025; }
    .seo-preview__counters { display: flex; gap: 16px; margin-top: 8px; font-size: 11px; color: var(--text-muted, #888); }
    .seo-preview__counters .over { color: #d93025; font-weight: 600; }
  `],
})
export class SeoPreviewComponent {
  @Input() set title(v: string) { this._title.set(v || ''); }
  @Input() set description(v: string) { this._description.set(v || ''); }
  @Input() set slug(v: string) { this._slug.set(v || ''); }
  @Input() siteUrl = 'https://catananti.dev';

  private _title = signal('');
  private _description = signal('');
  private _slug = signal('');

  titleLength = computed(() => this._title().length);
  descriptionLength = computed(() => this._description().length);
  titleTruncated = computed(() => this._title().length > 60);
  descriptionTruncated = computed(() => this._description().length > 160);

  displayUrl = computed(() => `${this.siteUrl}/blog/${this._slug() || 'your-article-slug'}`);
  displayTitle = computed(() => {
    const t = this._title() || 'Article Title';
    return t.length > 60 ? t.slice(0, 57) + '...' : t;
  });
  displayDescription = computed(() => {
    const d = this._description() || 'Article description will appear here...';
    return d.length > 160 ? d.slice(0, 157) + '...' : d;
  });
}
