import { Injectable, inject, Renderer2, NgZone, RendererFactory2 } from '@angular/core';
import { NotificationService } from '../../../../../core/services/notification.service';
import { I18nService } from '../../../../../core/services/i18n.service';
import { setCopyIcon, setCheckIcon } from '../utils/copy-icon.util';

/**
 * Processes rendered article content: assigns heading IDs and injects code copy buttons.
 * Extracted from ArticleDetailComponent (Q7.1) to reduce component size.
 */
@Injectable({ providedIn: 'root' })
export class ContentProcessorService {
  private readonly zone = inject(NgZone);
  private readonly notification = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly rendererFactory = inject(RendererFactory2);

  /**
   * Assign stable IDs to h2/h3 headings inside the content element.
   * Returns the heading NodeList for observer setup.
   */
  processHeadings(renderer: Renderer2, contentEl: Element): NodeListOf<Element> {
    const headings = contentEl.querySelectorAll('h2, h3');
    headings.forEach((h) => {
      const text = (h.textContent || '').trim();
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      renderer.setAttribute(h, 'id', id);
    });
    return headings;
  }

  /**
   * Inject copy-to-clipboard buttons into `<pre>` code blocks.
   * Returns an array of cleanup functions for the click listeners.
   */
  addCopyButtons(renderer: Renderer2, hostEl: HTMLElement): (() => void)[] {
    const cleanups: (() => void)[] = [];
    const codeBlocks = hostEl.querySelectorAll('.article-content pre');

    codeBlocks.forEach((pre) => {
      if (pre.querySelector('.code-copy-btn')) return;

      const wrapper = renderer.createElement('div');
      renderer.addClass(wrapper, 'code-block-wrapper');
      renderer.setStyle(wrapper, 'position', 'relative');
      renderer.setStyle(wrapper, 'margin', '1.5rem 0');
      renderer.insertBefore(pre.parentNode, wrapper, pre);
      renderer.appendChild(wrapper, pre);
      renderer.setStyle(pre, 'margin', '0');

      const btn = renderer.createElement('button');
      renderer.addClass(btn, 'code-copy-btn');
      renderer.setAttribute(btn, 'title', this.i18n.t('blog.copyCode'));
      renderer.setAttribute(btn, 'aria-label', this.i18n.t('blog.copyCode'));
      renderer.setAttribute(btn, 'type', 'button');
      renderer.setStyle(btn, 'position', 'absolute');
      renderer.setStyle(btn, 'top', '0.5rem');
      renderer.setStyle(btn, 'right', '0.5rem');
      renderer.setStyle(btn, 'background', 'rgba(255, 255, 255, 0.12)');
      renderer.setStyle(btn, 'border', '1px solid rgba(255, 255, 255, 0.15)');
      renderer.setStyle(btn, 'border-radius', '6px');
      renderer.setStyle(btn, 'color', '#94a3b8');
      renderer.setStyle(btn, 'cursor', 'pointer');
      renderer.setStyle(btn, 'padding', '0.375rem');
      renderer.setStyle(btn, 'line-height', '0');
      renderer.setStyle(btn, 'z-index', '1');
      renderer.setStyle(btn, 'transition', 'background 0.2s, color 0.2s');
      setCopyIcon(renderer, btn);

      const unlisten = renderer.listen(btn, 'click', () => {
        const code = pre.querySelector('code')?.textContent || pre.textContent || '';
        navigator.clipboard.writeText(code).then(() => {
          this.zone.run(() => {
            setCheckIcon(renderer, btn);
            this.notification.success(this.i18n.t('blog.codeCopied'));
            setTimeout(() => setCopyIcon(renderer, btn), 2000);
          });
        }).catch(() => {
          this.zone.run(() => {
            this.notification.error(this.i18n.t('blog.copyFailed'));
          });
        });
      });
      cleanups.push(unlisten);
      renderer.appendChild(wrapper, btn);
    });

    return cleanups;
  }
}
