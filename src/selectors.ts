import type { SelectorResult, SelectorType } from './types.js';

const MAX_CSS_DEPTH = 5;
const MAX_CSS_CLASSES = 3;

// ---------------------------------------------------------------------------
// DOM helpers – defensive against varying DOM implementations (domino, jsdom…)
// ---------------------------------------------------------------------------

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

function isRootTag(tag: string): boolean {
  return (
    tag === 'body' ||
    tag === 'html' ||
    tag === '#document' ||
    tag.startsWith('x-turndown')
  );
}

function isTurndownId(id: string): boolean {
  return id.startsWith('turndown');
}

// ---------------------------------------------------------------------------
// Position counting – walks siblings rather than building arrays
// ---------------------------------------------------------------------------

/**
 * Counts the 1-based position of `node` among same-tag siblings and whether
 * any same-tag siblings exist at all.  Walking previousSibling / nextSibling
 * is more robust across DOM implementations than Array.indexOf.
 */
function countSameTagPosition(node: any): {
  hasSiblings: boolean;
  index: number;
} {
  const tag = getTagName(node);
  let index = 1;
  let hasSiblings = false;

  let sibling = node.previousSibling;
  while (sibling) {
    if (isElement(sibling) && getTagName(sibling) === tag) {
      index++;
      hasSiblings = true;
    }
    sibling = sibling.previousSibling;
  }

  if (!hasSiblings) {
    sibling = node.nextSibling;
    while (sibling) {
      if (isElement(sibling) && getTagName(sibling) === tag) {
        hasSiblings = true;
        break;
      }
      sibling = sibling.nextSibling;
    }
  }

  return { hasSiblings, index };
}

// ---------------------------------------------------------------------------
// CSS helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when `candidate` matches the same tag and (at least) all the
 * given classes.
 */
function matchesTagAndClasses(
  candidate: any,
  tag: string,
  classes: string[],
): boolean {
  if (getTagName(candidate) !== tag) return false;
  const candidateClasses = getClasses(candidate);
  return classes.every((c) => candidateClasses.includes(c));
}

/**
 * Generates the shortest unambiguous CSS segment for a single element
 * relative to its parent.
 *
 *  Priority: #id → [data-testid] → tag.classes (if unique) → tag:nth-of-type
 */
function getUniqueSegment(node: any): string {
  const tag = getTagName(node);

  // 1. ID – globally unique
  const id = getAttribute(node, 'id');
  if (id && !isTurndownId(id)) {
    return `#${cssEscape(id)}`;
  }

  // 2. data-testid – stable test hook
  const testId = getAttribute(node, 'data-testid');
  if (testId) {
    return `${tag}[data-testid="${testId}"]`;
  }

  // 3. Try class combination – check if it uniquely identifies among siblings
  const cls = getClasses(node).slice(0, MAX_CSS_CLASSES);
  if (cls.length > 0) {
    const classSelector = `${tag}.${cls.map(cssEscape).join('.')}`;
    const parent = getParent(node);
    if (parent && isElement(parent)) {
      const siblings = getElementChildren(parent);
      const matches = siblings.filter((s: any) =>
        matchesTagAndClasses(s, tag, cls),
      );
      if (matches.length === 1) {
        return classSelector;
      }
    }
    // Classes exist but are not unique – fall through and add nth-of-type
  }

  // 4. Fallback – tag with :nth-of-type (only when same-tag siblings exist)
  const { hasSiblings, index } = countSameTagPosition(node);
  const classPart =
    cls.length > 0 ? `.${cls.map(cssEscape).join('.')}` : '';

  if (hasSiblings) {
    return `${tag}${classPart}:nth-of-type(${index})`;
  }

  return cls.length > 0 ? `${tag}${classPart}` : tag;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function computeCSSSelector(el: any): string {
  if (!isElement(el)) return '';

  const parts: string[] = [];
  let current: any = el;

  while (current && isElement(current)) {
    const tag = getTagName(current);
    if (isRootTag(tag)) break;

    const segment = getUniqueSegment(current);
    parts.unshift(segment);

    // An id-based segment anchors the path – no need to go higher
    if (segment.startsWith('#')) break;
    // data-testid is similarly stable
    if (segment.includes('[data-testid=')) break;

    if (parts.length >= MAX_CSS_DEPTH) break;
    if (getClasses(current).length > 0 && parts.length >= 2) break;

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
    if (isRootTag(tag)) break;

    const id = getAttribute(current, 'id');
    if (id && !isTurndownId(id)) {
      parts.unshift(`${tag}[@id='${id}']`);
      return '//' + parts.join('/');
    }

    let step = tag;
    const { hasSiblings, index } = countSameTagPosition(current);
    if (hasSiblings) {
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
