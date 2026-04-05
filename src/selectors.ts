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

// ---------------------------------------------------------------------------
// Stability heuristics
// ---------------------------------------------------------------------------

/**
 * Detects IDs and class names that are likely generated/dynamic and therefore
 * fragile for scraping (CSS modules hashes, framework-generated IDs, etc.).
 */
function looksGenerated(value: string): boolean {
  // Turndown internals
  if (value.startsWith('turndown')) return true;

  // 4+ consecutive digits → likely dynamic (item_12345, product-9837)
  if (/\d{4,}/.test(value)) return true;

  // UUID-like patterns
  if (/[0-9a-f]{8}-[0-9a-f]{4}/i.test(value)) return true;

  // Framework-generated prefixes
  if (/^(__|:r\d|:R|rc-|ng-|_\$|ember\d|ext-)/.test(value)) return true;

  // CSS-in-JS patterns (styled-components, emotion, etc.)
  if (/^(sc-|css-|emotion-|jss-|makeStyles-|styled-)/.test(value)) return true;

  // Hex hash suffix preceded by separator (CSS modules, build tooling)
  // e.g. "Header_a3f2b1", "styles-abc123" but NOT "product-title"
  if (/[-_](?=[a-f0-9]*\d)[a-f0-9]{5,}$/i.test(value)) return true;

  return false;
}

/**
 * Returns only stable (non-generated) classes, capped at MAX_CSS_CLASSES.
 */
function getStableClasses(node: any): string[] {
  return getClasses(node)
    .filter((c) => !looksGenerated(c))
    .slice(0, MAX_CSS_CLASSES);
}

// ---------------------------------------------------------------------------
// Position counting – walks siblings rather than building arrays
// ---------------------------------------------------------------------------

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
// CSS segment generation
// ---------------------------------------------------------------------------

/**
 * Checks whether `candidate` has the same tag name and at least all the
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
 * Stability priority (most → least robust for scraping):
 *   [data-testid] → tag.stableClasses (if unique) → #stableId → tag:nth-of-type
 *
 * Dynamic IDs and generated class names are filtered out so the LLM
 * receives selectors that survive across page loads and content changes.
 */
function getUniqueSegment(node: any): string {
  const tag = getTagName(node);

  // 1. data-testid – explicitly stable, placed for testing / analytics
  const testId = getAttribute(node, 'data-testid');
  if (testId) {
    return `${tag}[data-testid="${testId}"]`;
  }

  // 2. Unique stable class combination
  const cls = getStableClasses(node);
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
  }

  // 3. Stable ID – only if it looks human-written and reusable
  const id = getAttribute(node, 'id');
  if (id && !looksGenerated(id)) {
    return `#${cssEscape(id)}`;
  }

  // 4. Fallback – tag ± stable classes ± :nth-of-type
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

    // Strong anchors stop traversal
    if (segment.startsWith('#') || segment.includes('[data-testid=')) break;

    if (parts.length >= MAX_CSS_DEPTH) break;
    if (getStableClasses(current).length > 0 && parts.length >= 2) break;

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

    // Only use stable IDs as XPath shortcuts
    const id = getAttribute(current, 'id');
    if (id && !looksGenerated(id)) {
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
