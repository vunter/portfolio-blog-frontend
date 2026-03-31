/**
 * Q8.2: Extracted from ArticleDetailComponent to reduce file size.
 * SVG icon helpers for code block copy buttons.
 */
import { Renderer2 } from '@angular/core';

function createSvg(renderer: Renderer2, children: Array<{tag: string; attrs: Record<string, string>}>): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  renderer.setAttribute(svg, 'width', '14');
  renderer.setAttribute(svg, 'height', '14');
  renderer.setAttribute(svg, 'viewBox', '0 0 24 24');
  renderer.setAttribute(svg, 'fill', 'none');
  renderer.setAttribute(svg, 'stroke', 'currentColor');
  renderer.setAttribute(svg, 'stroke-width', '2');
  for (const child of children) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', child.tag);
    for (const [attr, val] of Object.entries(child.attrs)) {
      renderer.setAttribute(el, attr, val);
    }
    renderer.appendChild(svg, el);
  }
  return svg;
}

export function setCopyIcon(renderer: Renderer2, btn: HTMLElement): void {
  while (btn.firstChild) btn.removeChild(btn.firstChild);
  renderer.appendChild(btn, createSvg(renderer, [
    { tag: 'rect', attrs: { x: '9', y: '9', width: '13', height: '13', rx: '2' } },
    { tag: 'path', attrs: { d: 'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1' } },
  ]));
}

export function setCheckIcon(renderer: Renderer2, btn: HTMLElement): void {
  while (btn.firstChild) btn.removeChild(btn.firstChild);
  renderer.appendChild(btn, createSvg(renderer, [
    { tag: 'polyline', attrs: { points: '20 6 9 17 4 12' } },
  ]));
}
