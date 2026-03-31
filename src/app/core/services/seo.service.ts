import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { environment } from '../../../environments/environment';
import { I18nService } from './i18n.service';

export interface SeoConfig {
  title: string;
  description: string;
  url?: string;
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
  locale?: string;
  noIndex?: boolean;
}

/**
 * SEO service for managing meta tags, Open Graph, Twitter Cards, and JSON-LD.
 * Should be called from every public-facing page component.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly titleService = inject(Title);
  private readonly doc = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);

  private readonly siteName = 'Catananti Dev';
  private get defaultDescription(): string {
    return this.i18n.t('seo.default.description');
  }
  private readonly siteUrl = environment.siteUrl;
  private readonly defaultImage = `${this.siteUrl}/icons/icon-512x512.png`;

  /**
   * Set all SEO meta tags for a page.
   */
  update(config: SeoConfig): void {
    const title = config.title ? `${config.title} | ${this.siteName}` : this.siteName;
    const description = config.description || this.defaultDescription;
    const url = config.url ? `${this.siteUrl}${config.url}` : this.siteUrl;
    const image = config.image || this.defaultImage;
    const type = config.type || 'website';
    const locale = config.locale || 'en_US';

    // Page title
    this.titleService.setTitle(title);

    // Standard meta
    this.meta.updateTag({ name: 'description', content: description });
    if (config.noIndex) {
      this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    } else {
      this.meta.removeTag('name="robots"');
    }

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:site_name', content: this.siteName });
    this.meta.updateTag({ property: 'og:locale', content: locale });

    // Twitter Card
    this.meta.updateTag({ name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    // Article-specific OG tags
    if (type === 'article') {
      if (config.publishedTime) {
        this.meta.updateTag({ property: 'article:published_time', content: config.publishedTime });
      }
      if (config.modifiedTime) {
        this.meta.updateTag({ property: 'article:modified_time', content: config.modifiedTime });
      }
      if (config.author) {
        this.meta.updateTag({ property: 'article:author', content: config.author });
      }
      config.tags?.forEach((tag) => {
        this.meta.updateTag({ property: 'article:tag', content: tag });
      });
    }

    // Canonical URL
    this.updateCanonical(url);

    // JSON-LD structured data
    if (type === 'article') {
      this.setArticleJsonLd(config, url, image);
    } else {
      this.setWebsiteJsonLd();
    }
  }

  /**
   * Reset meta tags to defaults (useful on navigation away).
   */
  resetToDefaults(): void {
    this.update({
      title: '',
      description: this.defaultDescription,
      url: '/',
    });
  }

  /**
   * Map a language code to an Open Graph locale string.
   */
  getLocale(lang: string): string {
    const localeMap: Record<string, string> = {
      en: 'en_US',
      pt: 'pt_BR',
      es: 'es_ES',
      it: 'it_IT',
    };
    return localeMap[lang] || 'en_US';
  }

  private updateCanonical(url: string): void {
    let link: HTMLLinkElement | null = this.doc.querySelector('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setArticleJsonLd(config: SeoConfig, url: string, image: string): void {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: config.title,
      description: config.description,
      url,
      image,
      datePublished: config.publishedTime,
      dateModified: config.modifiedTime || config.publishedTime,
      author: {
        '@type': 'Person',
        name: config.author || this.siteName,
      },
      publisher: {
        '@type': 'Organization',
        name: this.siteName,
        logo: {
          '@type': 'ImageObject',
          url: this.defaultImage,
        },
      },
      keywords: config.tags?.join(', '),
    };
    this.setJsonLd(jsonLd);
  }

  private setWebsiteJsonLd(): void {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: this.siteName,
      url: this.siteUrl,
    };
    this.setJsonLd(jsonLd);
  }

  private setJsonLd(data: Record<string, unknown>): void {
    let script: HTMLScriptElement | null = this.doc.querySelector('script[type="application/ld+json"]');
    if (!script) {
      script = this.doc.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      this.doc.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }
}
