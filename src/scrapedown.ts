import TurndownService from 'turndown';
import { computeSelectors } from './selectors.js';
import type {
  ScrapedownOptions,
  AnnotatableElement,
  AnnotationPlacement,
  SelectorResult,
  SelectorType,
} from './types.js';

const DEFAULT_ELEMENTS: AnnotatableElement[] = [
  'heading',
  'paragraph',
  'link',
  'image',
  'list',
  'blockquote',
  'codeBlock',
];

interface ResolvedOptions {
  annotationPlacement: AnnotationPlacement;
  selectors: SelectorType[];
  elements: AnnotatableElement[];
  turndown: TurndownService.Options;
}

export class Scrapedown {
  private service: TurndownService;
  private opts: ResolvedOptions;
  private footnotes: SelectorResult[] = [];

  constructor(options: ScrapedownOptions = {}) {
    this.opts = {
      annotationPlacement: options.annotationPlacement ?? 'inline',
      selectors: options.selectors ?? ['css', 'xpath'],
      elements: options.elements ?? DEFAULT_ELEMENTS,
      turndown: options.turndown ?? {},
    };

    this.service = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      ...this.opts.turndown,
    });

    this.installRules();
  }

  convert(html: string): string {
    this.footnotes = [];
    let md = this.service.turndown(html);

    if (this.opts.annotationPlacement === 'footnote' && this.footnotes.length > 0) {
      md += '\n\n---\n\n';
      md += this.footnotes
        .map((sel, i) => {
          const parts: string[] = [];
          if (sel.css) parts.push(`css: \`${sel.css}\``);
          if (sel.xpath) parts.push(`xpath: \`${sel.xpath}\``);
          return `[^s${i + 1}]: ${parts.join(' | ')}`;
        })
        .join('\n');
    }

    return md;
  }

  // ---------------------------------------------------------------------------
  // Annotation helpers
  // ---------------------------------------------------------------------------

  /**
   * For elements with natural text (headings, paragraphs, links, images):
   * - inline → HTML comment
   * - footnote → [^sN] reference
   *
   * For container elements (lists, blockquotes, code blocks) we always
   * emit an HTML comment because a bare footnote ref looks awkward.
   */
  private annotate(node: any, forceInline = false): string {
    const sel = computeSelectors(node, this.opts.selectors);
    if (this.opts.annotationPlacement === 'inline' || forceInline) {
      return this.fmtInline(sel);
    }
    this.footnotes.push(sel);
    return `[^s${this.footnotes.length}]`;
  }

  private fmtInline(sel: SelectorResult): string {
    const parts: string[] = [];
    if (sel.css) parts.push(`css="${sel.css}"`);
    if (sel.xpath) parts.push(`xpath="${sel.xpath}"`);
    return `<!-- ${parts.join(' ')} -->`;
  }

  // ---------------------------------------------------------------------------
  // Rule installation
  // ---------------------------------------------------------------------------

  private has(el: AnnotatableElement): boolean {
    return this.opts.elements.includes(el);
  }

  private installRules(): void {
    if (this.has('heading')) this.addHeadingRule();
    if (this.has('paragraph')) this.addParagraphRule();
    if (this.has('link')) this.addLinkRule();
    if (this.has('image')) this.addImageRule();
    if (this.has('list')) this.addListRule();
    if (this.has('listItem')) this.addListItemRule();
    if (this.has('blockquote')) this.addBlockquoteRule();
    if (this.has('codeBlock')) this.addCodeBlockRule();
  }

  // ---------------------------------------------------------------------------
  // Rules – each replicates the Turndown default then appends annotation
  // ---------------------------------------------------------------------------

  private addHeadingRule(): void {
    this.service.addRule('sd-heading', {
      filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as any,
      replacement: (content, node, _options) => {
        const level = Number(node.nodeName.charAt(1));
        const text = content.replace(/\n/g, ' ').trim();
        if (!text) return '';

        const hashes = '#'.repeat(level);
        const ann = this.annotate(node);

        if (this.opts.annotationPlacement === 'inline') {
          return `\n\n${hashes} ${text}\n${ann}\n\n`;
        }
        return `\n\n${hashes} ${text}${ann}\n\n`;
      },
    });
  }

  private addParagraphRule(): void {
    this.service.addRule('sd-paragraph', {
      filter: 'p' as any,
      replacement: (content, node) => {
        const text = content.trim();
        if (!text) return '';

        const ann = this.annotate(node);

        if (this.opts.annotationPlacement === 'inline') {
          return `\n\n${text}\n${ann}\n\n`;
        }
        return `\n\n${text}${ann}\n\n`;
      },
    });
  }

  private addLinkRule(): void {
    this.service.addRule('sd-link', {
      filter: ((node: any) =>
        node.nodeName === 'A' &&
        !!node.getAttribute('href')) as any,
      replacement: (content, node) => {
        const href = node.getAttribute('href') || '';
        const title = node.getAttribute('title');
        const titlePart = title ? ` "${title}"` : '';
        const ann = this.annotate(node);
        return `[${content}](${href}${titlePart})${ann}`;
      },
    });
  }

  private addImageRule(): void {
    this.service.addRule('sd-image', {
      filter: 'img' as any,
      replacement: (_content, node) => {
        const alt = (node.getAttribute('alt') || '').replace(/\n/g, ' ');
        const src = node.getAttribute('src') || '';
        const title = node.getAttribute('title');
        const titlePart = title ? ` "${title}"` : '';
        if (!src) return '';

        const ann = this.annotate(node);

        if (this.opts.annotationPlacement === 'inline') {
          return `![${alt}](${src}${titlePart})\n${ann}`;
        }
        return `![${alt}](${src}${titlePart})${ann}`;
      },
    });
  }

  private addListRule(): void {
    this.service.addRule('sd-list', {
      filter: ['ul', 'ol'] as any,
      replacement: (content, node) => {
        const parent = node.parentNode;
        const ann = this.annotate(node, true);

        const isNestedList =
          parent &&
          parent.nodeName === 'LI' &&
          (parent as any).lastElementChild === node;

        if (isNestedList) {
          return `\n${content}`;
        }

        return `\n\n${content}${ann}\n\n`;
      },
    });
  }

  private addListItemRule(): void {
    this.service.addRule('sd-listItem', {
      filter: 'li' as any,
      replacement: (content, node, options) => {
        let text = content
          .replace(/^\n+/, '')
          .replace(/\n+$/, '\n')
          .replace(/\n/gm, '\n    ');

        let prefix = (options.bulletListMarker || '-') + '   ';
        const parent = node.parentNode;

        if (parent && parent.nodeName === 'OL') {
          const start = (parent as any).getAttribute?.('start');
          const children = Array.from(
            (parent as any).children || (parent as any).childNodes || [],
          ).filter((n: any) => n.nodeType === 1);
          const index = children.indexOf(node as any);
          prefix = (start ? Number(start) + index : index + 1) + '.  ';
        }

        const ann = this.annotate(node);

        if (this.opts.annotationPlacement === 'inline') {
          const result = `${prefix}${text.replace(/\n$/, '')} ${ann}\n`;
          return result;
        }

        const result = `${prefix}${text.replace(/\n$/, '')}${ann}\n`;
        return result;
      },
    });
  }

  private addBlockquoteRule(): void {
    this.service.addRule('sd-blockquote', {
      filter: 'blockquote' as any,
      replacement: (content, node) => {
        let text = content.replace(/^\n+|\n+$/g, '');
        text = text.replace(/^/gm, '> ');
        const ann = this.annotate(node, true);
        return `\n\n${text}\n${ann}\n\n`;
      },
    });
  }

  private addCodeBlockRule(): void {
    this.service.addRule('sd-codeBlock', {
      filter: ((node: any) =>
        node.nodeName === 'PRE' &&
        node.firstChild &&
        node.firstChild.nodeName === 'CODE') as any,
      replacement: (_content, node) => {
        const codeNode = (node as any).firstChild;
        const className = codeNode.getAttribute?.('class') || '';
        const language =
          (className.match(/language-(\S+)/) || [null, ''])[1] || '';
        const code = codeNode.textContent || '';

        const fenceChar = '`';
        let fenceSize = 3;
        const fenceRe = new RegExp('^`{3,}', 'gm');
        let match;
        while ((match = fenceRe.exec(code))) {
          if (match[0].length >= fenceSize) fenceSize = match[0].length + 1;
        }
        const fence = fenceChar.repeat(fenceSize);

        const ann = this.annotate(node, true);
        return `\n\n${fence}${language}\n${code.replace(/\n$/, '')}\n${fence}\n${ann}\n\n`;
      },
    });
  }
}

/**
 * Convert HTML to annotated Markdown in one call.
 */
export function scrapedown(
  html: string,
  options?: ScrapedownOptions,
): string {
  return new Scrapedown(options).convert(html);
}
