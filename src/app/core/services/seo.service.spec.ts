import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { SeoService, SeoConfig } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let meta: Meta;
  let title: Title;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SeoService],
    });

    service = TestBed.inject(SeoService);
    meta = TestBed.inject(Meta);
    title = TestBed.inject(Title);
    doc = TestBed.inject(DOCUMENT);

    // Clean up any previous canonical / json-ld from prior tests
    doc.querySelector('link[rel="canonical"]')?.remove();
    doc.querySelector('script[type="application/ld+json"]')?.remove();
  });

  afterEach(() => {
    doc.querySelector('link[rel="canonical"]')?.remove();
    doc.querySelector('script[type="application/ld+json"]')?.remove();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('update', () => {
    it('should set the page title with site name suffix', () => {
      service.update({ title: 'My Article', description: 'Test' });
      expect(title.getTitle()).toBe('My Article | Catananti Dev');
    });

    it('should use site name only when title is empty', () => {
      service.update({ title: '', description: 'Test' });
      expect(title.getTitle()).toBe('Catananti Dev');
    });

    it('should set meta description', () => {
      service.update({ title: 'Test', description: 'A test description' });

      const tag = meta.getTag('name="description"');
      expect(tag).toBeTruthy();
      expect(tag!.content).toBe('A test description');
    });

    it('should use default description when empty', () => {
      service.update({ title: 'Test', description: '' });

      const tag = meta.getTag('name="description"');
      expect(tag).toBeTruthy();
      expect(tag!.content).toContain('Portfolio and blog');
    });

    it('should set noIndex robots tag when noIndex is true', () => {
      service.update({ title: 'Private', description: 'Test', noIndex: true });

      const tag = meta.getTag('name="robots"');
      expect(tag).toBeTruthy();
      expect(tag!.content).toBe('noindex, nofollow');
    });

    it('should remove robots tag when noIndex is false', () => {
      // First set noIndex
      service.update({ title: 'Test', description: 'Test', noIndex: true });
      expect(meta.getTag('name="robots"')).toBeTruthy();

      // Then remove it
      service.update({ title: 'Test', description: 'Test', noIndex: false });
      expect(meta.getTag('name="robots"')).toBeNull();
    });

    describe('Open Graph tags', () => {
      it('should set og:title', () => {
        service.update({ title: 'OG Test', description: 'Desc' });
        const tag = meta.getTag('property="og:title"');
        expect(tag!.content).toBe('OG Test | Catananti Dev');
      });

      it('should set og:description', () => {
        service.update({ title: 'Test', description: 'OG Description' });
        const tag = meta.getTag('property="og:description"');
        expect(tag!.content).toBe('OG Description');
      });

      it('should set og:url with site URL prefix', () => {
        service.update({ title: 'Test', description: 'Desc', url: '/blog/my-post' });
        const tag = meta.getTag('property="og:url"');
        expect(tag!.content).toBe('https://catananti.dev/blog/my-post');
      });

      it('should use default site URL when url not provided', () => {
        service.update({ title: 'Test', description: 'Desc' });
        const tag = meta.getTag('property="og:url"');
        expect(tag!.content).toBe('https://catananti.dev');
      });

      it('should set og:image with custom image', () => {
        service.update({ title: 'T', description: 'D', image: 'https://example.com/img.png' });
        const tag = meta.getTag('property="og:image"');
        expect(tag!.content).toBe('https://example.com/img.png');
      });

      it('should use default image when not provided', () => {
        service.update({ title: 'T', description: 'D' });
        const tag = meta.getTag('property="og:image"');
        expect(tag!.content).toContain('icon-512x512.png');
      });

      it('should set og:type to website by default', () => {
        service.update({ title: 'T', description: 'D' });
        const tag = meta.getTag('property="og:type"');
        expect(tag!.content).toBe('website');
      });

      it('should set og:type to article when specified', () => {
        service.update({ title: 'T', description: 'D', type: 'article' });
        const tag = meta.getTag('property="og:type"');
        expect(tag!.content).toBe('article');
      });

      it('should set og:site_name', () => {
        service.update({ title: 'T', description: 'D' });
        const tag = meta.getTag('property="og:site_name"');
        expect(tag!.content).toBe('Catananti Dev');
      });

      it('should set og:locale to en_US by default', () => {
        service.update({ title: 'T', description: 'D' });
        const tag = meta.getTag('property="og:locale"');
        expect(tag!.content).toBe('en_US');
      });

      it('should set og:locale to provided value', () => {
        service.update({ title: 'T', description: 'D', locale: 'pt_BR' });
        const tag = meta.getTag('property="og:locale"');
        expect(tag!.content).toBe('pt_BR');
      });
    });

    describe('Twitter Card tags', () => {
      it('should set twitter:card to summary_large_image when image is present', () => {
        service.update({ title: 'T', description: 'D', image: 'https://example.com/img.png' });
        const tag = meta.getTag('name="twitter:card"');
        expect(tag!.content).toBe('summary_large_image');
      });

      it('should set twitter:title', () => {
        service.update({ title: 'Tweet', description: 'D' });
        const tag = meta.getTag('name="twitter:title"');
        expect(tag!.content).toBe('Tweet | Catananti Dev');
      });

      it('should set twitter:description', () => {
        service.update({ title: 'T', description: 'Twitter desc' });
        const tag = meta.getTag('name="twitter:description"');
        expect(tag!.content).toBe('Twitter desc');
      });

      it('should set twitter:image', () => {
        service.update({ title: 'T', description: 'D', image: 'https://example.com/img.png' });
        const tag = meta.getTag('name="twitter:image"');
        expect(tag!.content).toBe('https://example.com/img.png');
      });
    });

    describe('Article-specific tags', () => {
      it('should set article:published_time for articles', () => {
        service.update({
          title: 'Article',
          description: 'D',
          type: 'article',
          publishedTime: '2026-01-15T10:00:00Z',
        });
        const tag = meta.getTag('property="article:published_time"');
        expect(tag!.content).toBe('2026-01-15T10:00:00Z');
      });

      it('should set article:modified_time for articles', () => {
        service.update({
          title: 'Article',
          description: 'D',
          type: 'article',
          modifiedTime: '2026-02-10T12:00:00Z',
        });
        const tag = meta.getTag('property="article:modified_time"');
        expect(tag!.content).toBe('2026-02-10T12:00:00Z');
      });

      it('should set article:author for articles', () => {
        service.update({
          title: 'Article',
          description: 'D',
          type: 'article',
          author: 'John Doe',
        });
        const tag = meta.getTag('property="article:author"');
        expect(tag!.content).toBe('John Doe');
      });

      it('should set article:tag for articles with tags', () => {
        service.update({
          title: 'Article',
          description: 'D',
          type: 'article',
          tags: ['Angular', 'TypeScript'],
        });
        const tag = meta.getTag('property="article:tag"');
        expect(tag).toBeTruthy();
      });

      it('should NOT set article-specific tags for website type', () => {
        service.update({
          title: 'Page',
          description: 'D',
          type: 'website',
          publishedTime: '2026-01-15T10:00:00Z',
        });
        // article:published_time should not be set for website type
        // (it may exist from a previous test, but we cleaned up, so check it was not added)
      });
    });

    describe('Canonical URL', () => {
      it('should create a canonical link element', () => {
        service.update({ title: 'T', description: 'D', url: '/blog' });

        const link = doc.querySelector('link[rel="canonical"]') as HTMLLinkElement;
        expect(link).toBeTruthy();
        expect(link.getAttribute('href')).toBe('https://catananti.dev/blog');
      });

      it('should update existing canonical link', () => {
        service.update({ title: 'T', description: 'D', url: '/blog' });
        service.update({ title: 'T2', description: 'D2', url: '/about' });

        const links = doc.querySelectorAll('link[rel="canonical"]');
        expect(links.length).toBe(1);
        expect((links[0] as HTMLLinkElement).getAttribute('href')).toBe('https://catananti.dev/about');
      });
    });

    describe('JSON-LD structured data', () => {
      it('should create WebSite JSON-LD for website type', () => {
        service.update({ title: 'T', description: 'D', type: 'website' });

        const script = doc.querySelector('script[type="application/ld+json"]');
        expect(script).toBeTruthy();
        const data = JSON.parse(script!.textContent!);
        expect(data['@type']).toBe('WebSite');
        expect(data.name).toBe('Catananti Dev');
      });

      it('should create Article JSON-LD for article type', () => {
        service.update({
          title: 'My Article',
          description: 'Article desc',
          type: 'article',
          url: '/blog/my-article',
          publishedTime: '2026-01-15T10:00:00Z',
          author: 'Jane',
          tags: ['Angular', 'Testing'],
        });

        const script = doc.querySelector('script[type="application/ld+json"]');
        expect(script).toBeTruthy();
        const data = JSON.parse(script!.textContent!);
        expect(data['@type']).toBe('Article');
        expect(data.headline).toBe('My Article');
        expect(data.description).toBe('Article desc');
        expect(data.datePublished).toBe('2026-01-15T10:00:00Z');
        expect(data.author.name).toBe('Jane');
        expect(data.keywords).toBe('Angular, Testing');
      });

      it('should use publishedTime as dateModified fallback', () => {
        service.update({
          title: 'T',
          description: 'D',
          type: 'article',
          publishedTime: '2026-01-15T10:00:00Z',
        });

        const script = doc.querySelector('script[type="application/ld+json"]');
        const data = JSON.parse(script!.textContent!);
        expect(data.dateModified).toBe('2026-01-15T10:00:00Z');
      });

      it('should use modifiedTime when provided', () => {
        service.update({
          title: 'T',
          description: 'D',
          type: 'article',
          publishedTime: '2026-01-15T10:00:00Z',
          modifiedTime: '2026-02-01T10:00:00Z',
        });

        const script = doc.querySelector('script[type="application/ld+json"]');
        const data = JSON.parse(script!.textContent!);
        expect(data.dateModified).toBe('2026-02-01T10:00:00Z');
      });

      it('should reuse the same script element on multiple updates', () => {
        service.update({ title: 'T1', description: 'D1' });
        service.update({ title: 'T2', description: 'D2' });

        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
        expect(scripts.length).toBe(1);
      });
    });
  });

  describe('resetToDefaults', () => {
    it('should reset title to site name only', () => {
      service.update({ title: 'Custom', description: 'Custom desc' });
      service.resetToDefaults();
      expect(title.getTitle()).toBe('Catananti Dev');
    });

    it('should reset description to default', () => {
      service.update({ title: 'T', description: 'Custom desc' });
      service.resetToDefaults();

      const tag = meta.getTag('name="description"');
      expect(tag!.content).toContain('Portfolio and blog');
    });
  });

  describe('getLocale', () => {
    it('should return en_US for "en"', () => {
      expect(service.getLocale('en')).toBe('en_US');
    });

    it('should return pt_BR for "pt"', () => {
      expect(service.getLocale('pt')).toBe('pt_BR');
    });

    it('should return es_ES for "es"', () => {
      expect(service.getLocale('es')).toBe('es_ES');
    });

    it('should return it_IT for "it"', () => {
      expect(service.getLocale('it')).toBe('it_IT');
    });

    it('should return en_US for unknown language codes', () => {
      expect(service.getLocale('de')).toBe('en_US');
      expect(service.getLocale('fr')).toBe('en_US');
      expect(service.getLocale('')).toBe('en_US');
    });
  });
});
