import type { SelectorResult, SelectorType } from './types.js';

const MAX_CSS_DEPTH = 5;

function isElement(node: unknown): boolean {
  return !!node && (node as any).nodeType === 1;
}

function getTagName(node: any): string {
  return (node.nodeName || node.tagName || '').toLowerCase();
}

function getAttribute(node: any, attr: string): string {
  if (typeof node.getAttribute === 'function') {
    return node.getAttribute(attr) || '';
  }
  return '';
}

function getParent(node: any): any {
  return node.parentNode || node.parentElement || null;
}

function getElementChildren(node: any): any[] {
  if (node.children) return Array.from(node.children);
  if (node.childNodes) {
    return Array.from(node.childNodes as ArrayLike<any>).filter(
      (n: any) => n.nodeType === 1,
    );
  }
  return [];
}

function cssEscape(value: string): string {
  return value.replace(/([^\w-])/g, '\\$1');
}

function getClasses(node: any): string[] {
  return getAttribute(node, 'class').trim().split(/\s+/).filter(Boolean);
}

function getSameTagSiblingIndex(node: any): { count: number; index: number } {
  const parent = getParent(node);
  if (!parent || !isElement(parent)) return { count: 1, index: 1 };

  const tag = getTagName(node);
  const siblings = getElementChildren(parent).filter(
    (s: any) => getTagName(s) === tag,
  );
  return { count: siblings.length, index: siblings.indexOf(node) + 1 };
}

export function computeCSSSelector(el: any): string {
  if (!isElement(el)) return '';

  const id = getAttribute(el, 'id');
  if (id && !id.startsWith('turndown')) return `#${cssEscape(id)}`;

  const dataTestId = getAttribute(el, 'data-testid');
  if (dataTestId) return `${getTagName(el)}[data-testid="${dataTestId}"]`;

  const parts: string[] = [];
  let current: any = el;

  while (current && isElement(current)) {
    const tag = getTagName(current);
    if (
      tag === 'body' ||
      tag === 'html' ||
      tag === '#document' ||
      tag.startsWith('x-turndown')
    )
      break;

    const currentId = getAttribute(current, 'id');
    if (currentId && !currentId.startsWith('turndown')) {
      parts.unshift(`#${cssEscape(currentId)}`);
      break;
    }

    let part = tag;
    const cls = getClasses(current);
    if (cls.length > 0) {
      part += '.' + cls.slice(0, 3).map(cssEscape).join('.');
    }

    const { count, index } = getSameTagSiblingIndex(current);
    if (count > 1 && index > 0) {
      part += `:nth-of-type(${index})`;
    }

    parts.unshift(part);

    if (parts.length >= MAX_CSS_DEPTH) break;
    if (cls.length > 0 && parts.length >= 2) break;

    current = getParent(current);
  }

  return parts.join(' > ');
}

export function computeXPath(el: any): string {
  if (!isElement(el)) return '';

  const parts: string[] = [];
  let current: any = el;

  while (current && isElement(current)) {
    const tag = getTagName(current);
    if (
      tag === 'body' ||
      tag === 'html' ||
      tag === '#document' ||
      tag.startsWith('x-turndown')
    )
      break;

    const id = getAttribute(current, 'id');
    if (id && !id.startsWith('turndown')) {
      parts.unshift(`${tag}[@id='${id}']`);
      return '//' + parts.join('/');
    }

    let step = tag;
    const { count, index } = getSameTagSiblingIndex(current);
    if (count > 1 && index > 0) {
      step += `[${index}]`;
    }

    parts.unshift(step);
    current = getParent(current);
  }

  return '//' + parts.join('/');
}

export function computeSelectors(
  node: any,
  types: SelectorType[],
): SelectorResult {
  const result: SelectorResult = {};
  if (types.includes('css')) result.css = computeCSSSelector(node);
  if (types.includes('xpath')) result.xpath = computeXPath(node);
  return result;
}
