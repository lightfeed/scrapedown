import { describe, it, expect, beforeEach } from 'vitest';
import { Scrapedown, scrapedown } from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inline(opts?: ConstructorParameters<typeof Scrapedown>[0]) {
  return new Scrapedown({ annotationPlacement: 'inline', ...opts });
}

function footnote(opts?: ConstructorParameters<typeof Scrapedown>[0]) {
  return new Scrapedown({ annotationPlacement: 'footnote', ...opts });
}

// ---------------------------------------------------------------------------
// Functional shorthand
// ---------------------------------------------------------------------------

describe('scrapedown()', () => {
  it('works as a one-shot function', () => {
    const md = scrapedown('<h1>Hello</h1>');
    expect(md).toContain('# Hello');
    expect(md).toContain('<!-- ');
  });
});

// ---------------------------------------------------------------------------
// Inline annotation mode
// ---------------------------------------------------------------------------

describe('Scrapedown – inline annotations', () => {
  let sd: Scrapedown;

  beforeEach(() => {
    sd = inline();
  });

  it('annotates headings', () => {
    const md = sd.convert('<h1 class="title">Hello World</h1>');
    expect(md).toContain('# Hello World');
    expect(md).toMatch(/css="h1\.title"/);
    expect(md).toMatch(/xpath="\/\/h1"/);
  });

  it('annotates h2-h6', () => {
    const md = sd.convert('<h3>Sub</h3>');
    expect(md).toContain('### Sub');
    expect(md).toContain('<!-- ');
  });

  it('annotates paragraphs', () => {
    const md = sd.convert('<p class="desc">Some text</p>');
    expect(md).toContain('Some text');
    expect(md).toMatch(/css="p\.desc"/);
  });

  it('annotates links', () => {
    const md = sd.convert(
      '<a href="https://example.com" class="ext">Click</a>',
    );
    expect(md).toContain('[Click](https://example.com)');
    expect(md).toMatch(/css="a\.ext"/);
  });

  it('annotates images', () => {
    const md = sd.convert(
      '<img src="/hero.png" alt="Hero image" class="hero" />',
    );
    expect(md).toContain('![Hero image](/hero.png)');
    expect(md).toMatch(/css="img\.hero"/);
  });

  it('annotates lists', () => {
    const md = sd.convert(
      '<ul class="features"><li>Fast</li><li>Reliable</li></ul>',
    );
    expect(md).toMatch(/-\s+Fast/);
    expect(md).toMatch(/-\s+Reliable/);
    expect(md).toMatch(/css="ul\.features"/);
  });

  it('annotates blockquotes', () => {
    const md = sd.convert(
      '<blockquote class="quote"><p>Be yourself.</p></blockquote>',
    );
    expect(md).toContain('> ');
    expect(md).toMatch(/css="blockquote\.quote"/);
  });

  it('annotates code blocks', () => {
    const md = sd.convert(
      '<pre><code class="language-js">console.log(1)</code></pre>',
    );
    expect(md).toContain('```js');
    expect(md).toContain('console.log(1)');
    expect(md).toContain('<!-- ');
  });
});

// ---------------------------------------------------------------------------
// Footnote annotation mode
// ---------------------------------------------------------------------------

describe('Scrapedown – footnote annotations', () => {
  let sd: Scrapedown;

  beforeEach(() => {
    sd = footnote();
  });

  it('adds footnote refs to headings', () => {
    const md = sd.convert('<h1>Title</h1>');
    expect(md).toMatch(/# Title\[\^s1\]/);
    expect(md).toContain('[^s1]:');
  });

  it('adds footnote refs to paragraphs', () => {
    const md = sd.convert('<p>Hello</p>');
    expect(md).toMatch(/Hello\[\^s1\]/);
    expect(md).toContain('[^s1]:');
  });

  it('adds footnote refs to links', () => {
    const md = sd.convert('<a href="/x">Link</a>');
    expect(md).toContain('[Link](/x)[^s1]');
    expect(md).toContain('[^s1]:');
  });

  it('uses inline comments for container elements even in footnote mode', () => {
    const md = sd.convert(
      '<ul class="items"><li>One</li></ul>',
    );
    expect(md).toContain('<!-- ');
  });

  it('collects multiple footnotes', () => {
    const md = sd.convert('<h1>A</h1><p>B</p>');
    expect(md).toContain('[^s1]');
    expect(md).toContain('[^s2]');
    expect(md).toContain('[^s1]:');
    expect(md).toContain('[^s2]:');
  });
});

// ---------------------------------------------------------------------------
// Selector configuration
// ---------------------------------------------------------------------------

describe('Scrapedown – selector options', () => {
  it('can produce CSS-only annotations', () => {
    const sd = inline({ selectors: ['css'] });
    const md = sd.convert('<h1 class="t">X</h1>');
    expect(md).toContain('css=');
    expect(md).not.toContain('xpath=');
  });

  it('can produce XPath-only annotations', () => {
    const sd = inline({ selectors: ['xpath'] });
    const md = sd.convert('<h1 class="t">X</h1>');
    expect(md).toContain('xpath=');
    expect(md).not.toContain('css=');
  });
});

// ---------------------------------------------------------------------------
// Element filtering
// ---------------------------------------------------------------------------

describe('Scrapedown – element options', () => {
  it('respects elements filter', () => {
    const sd = inline({ elements: ['heading'] });
    const md = sd.convert('<h1>Yes</h1><p>No annotation here</p>');

    const headingAnnotation = md.indexOf('<!-- ', md.indexOf('# Yes'));
    const pText = md.indexOf('No annotation here');

    expect(headingAnnotation).toBeGreaterThan(-1);

    const afterP = md.slice(pText);
    expect(afterP).not.toContain('<!-- ');
  });

  it('can enable listItem annotation', () => {
    const sd = inline({ elements: ['listItem'] });
    const md = sd.convert(
      '<ul><li class="item">A</li><li class="item">B</li></ul>',
    );
    expect(md).toMatch(/css=".*li/);
  });
});

// ---------------------------------------------------------------------------
// CSS selector generation (integration)
// ---------------------------------------------------------------------------

describe('CSS selector generation', () => {
  const sd = inline({ selectors: ['css'] });

  it('uses id when available', () => {
    const md = sd.convert('<h1 id="main-title">Title</h1>');
    expect(md).toContain('css="#main-title"');
  });

  it('uses class names', () => {
    const md = sd.convert('<p class="intro lead">Hello</p>');
    expect(md).toContain('css="p.intro.lead"');
  });

  it('builds ancestor chain for context', () => {
    const md = sd.convert(
      '<div class="card"><p class="price">$10</p></div>',
    );
    expect(md).toMatch(/div\.card > p\.price/);
  });

  it('adds nth-of-type for same-tag siblings', () => {
    const md = sd.convert(
      '<div><p>First</p><p>Second</p></div>',
    );
    expect(md).toMatch(/p:nth-of-type\(1\)/);
    expect(md).toMatch(/p:nth-of-type\(2\)/);
  });

  it('uses data-testid when available', () => {
    const md = sd.convert('<h1 data-testid="hero-title">Hi</h1>');
    expect(md).toContain('h1[data-testid="hero-title"]');
  });
});

// ---------------------------------------------------------------------------
// XPath generation (integration)
// ---------------------------------------------------------------------------

describe('XPath generation', () => {
  const sd = inline({ selectors: ['xpath'] });

  it('uses id shortcut', () => {
    const md = sd.convert('<h1 id="top">X</h1>');
    expect(md).toContain("h1[@id='top']");
  });

  it('adds positional index for same-tag siblings', () => {
    const md = sd.convert(
      '<div><p>A</p><p>B</p></div>',
    );
    expect(md).toMatch(/p\[1\]/);
    expect(md).toMatch(/p\[2\]/);
  });
});

// ---------------------------------------------------------------------------
// Complex HTML
// ---------------------------------------------------------------------------

describe('Complex HTML', () => {
  const html = `
    <div class="product-page">
      <h1 class="product-name">Widget Pro</h1>
      <p class="price">$29.99</p>
      <div class="details">
        <h2>Features</h2>
        <ul class="feature-list">
          <li>Lightweight</li>
          <li>Durable</li>
          <li>Waterproof</li>
        </ul>
        <blockquote class="testimonial">
          <p>Best widget I've ever used!</p>
        </blockquote>
      </div>
      <a href="/buy" class="cta-button">Buy Now</a>
    </div>
  `;

  it('produces readable annotated markdown', () => {
    const md = scrapedown(html);
    expect(md).toContain('# Widget Pro');
    expect(md).toContain('$29.99');
    expect(md).toContain('## Features');
    expect(md).toMatch(/-\s+Lightweight/);
    expect(md).toContain('[Buy Now](/buy)');
    expect(md).toContain('<!-- ');
  });

  it('works in footnote mode', () => {
    const md = scrapedown(html, { annotationPlacement: 'footnote' });
    expect(md).toContain('[^s');
    expect(md).toContain('[^s1]:');
  });
});
