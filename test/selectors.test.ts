import { describe, it, expect } from 'vitest';
import { Scrapedown } from '../src/index.js';

function css(html: string): string {
  return new Scrapedown({
    annotationPlacement: 'inline',
    selectors: ['css'],
  }).convert(html);
}

function xpath(html: string): string {
  return new Scrapedown({
    annotationPlacement: 'inline',
    selectors: ['xpath'],
  }).convert(html);
}

// ---------------------------------------------------------------------------
// CSS – stability priority
// ---------------------------------------------------------------------------

describe('CSS selectors – stability priority', () => {
  it('prefers data-testid over everything', () => {
    const md = css(
      '<h1 id="hero" class="title" data-testid="page-title">X</h1>',
    );
    expect(md).toContain('data-testid="page-title"');
    expect(md).not.toContain('#hero');
  });

  it('prefers stable classes over stable id', () => {
    const md = css('<h1 id="hero" class="product-title">X</h1>');
    expect(md).toContain('h1.product-title');
    expect(md).not.toContain('#hero');
  });

  it('falls back to stable id when classes are not unique', () => {
    const md = css(
      '<div><p id="first" class="item">A</p><p class="item">B</p></div>',
    );
    expect(md).toContain('#first');
  });

  it('caps stable classes at 3', () => {
    const md = css('<p class="a b c d e">Hi</p>');
    expect(md).toContain('p.a.b.c');
    expect(md).not.toContain('.d');
  });

  it('uses ancestor stable id as anchor', () => {
    const md = css(
      '<div id="app"><section><h2 class="sub">S</h2></section></div>',
    );
    expect(md).toMatch(/#app/);
  });

  it('handles no class, no id', () => {
    const md = css('<h1>Plain</h1>');
    expect(md).toContain('css="h1"');
  });
});

// ---------------------------------------------------------------------------
// CSS – nth-of-type
// ---------------------------------------------------------------------------

describe('CSS selectors – nth-of-type', () => {
  it('uses nth-of-type for same-tag classless siblings', () => {
    const md = css(`
      <div class="list">
        <p>One</p>
        <p>Two</p>
        <p>Three</p>
      </div>
    `);
    expect(md).toMatch(/p:nth-of-type\(1\)/);
    expect(md).toMatch(/p:nth-of-type\(2\)/);
    expect(md).toMatch(/p:nth-of-type\(3\)/);
  });

  it('skips nth-of-type when classes uniquely identify among siblings', () => {
    const md = css(`
      <div>
        <p class="title">A</p>
        <p class="body">B</p>
      </div>
    `);
    expect(md).toContain('p.title');
    expect(md).toContain('p.body');
    expect(md).not.toContain('nth-of-type');
  });

  it('adds nth-of-type when classes are shared among siblings', () => {
    const md = css(`
      <ul>
        <li class="item"><p>A</p></li>
        <li class="item"><p>B</p></li>
      </ul>
    `);
    expect(md).toMatch(/li\.item:nth-of-type\(1\)/);
    expect(md).toMatch(/li\.item:nth-of-type\(2\)/);
  });

  it('omits nth-of-type for sole element of its tag', () => {
    const md = css('<div><h1>Only heading</h1><p>Only para</p></div>');
    expect(md).not.toContain('nth-of-type');
  });
});

// ---------------------------------------------------------------------------
// CSS – dynamic / generated filtering
// ---------------------------------------------------------------------------

describe('CSS selectors – dynamic filtering', () => {
  it('skips IDs with long digit sequences', () => {
    const md = css('<h1 id="item_123456" class="title">X</h1>');
    expect(md).toContain('h1.title');
    expect(md).not.toContain('123456');
  });

  it('skips UUID-like IDs', () => {
    const md = css(
      '<h1 id="a1b2c3d4-e5f6-7890-abcd-ef1234567890" class="title">X</h1>',
    );
    expect(md).toContain('h1.title');
    expect(md).not.toContain('a1b2c3d4');
  });

  it('skips framework-generated IDs (__next, :r, rc-)', () => {
    const md = css('<h1 id="__next_abc" class="heading">X</h1>');
    expect(md).toContain('h1.heading');
    expect(md).not.toContain('__next');
  });

  it('skips CSS-in-JS class names', () => {
    const md = css('<h1 class="css-1abc2de title">X</h1>');
    expect(md).toContain('h1.title');
    expect(md).not.toContain('css-1abc2de');
  });

  it('skips CSS modules hash classes', () => {
    const md = css('<p class="Header_title_a3f2b1 title">X</p>');
    expect(md).toContain('p.title');
    expect(md).not.toContain('a3f2b1');
  });

  it('keeps semantic IDs like "main-content"', () => {
    const md = css(
      '<div id="main-content"><h1 class="title">X</h1></div>',
    );
    expect(md).toMatch(/#main-content/);
  });

  it('keeps semantic classes like "product-card"', () => {
    const md = css('<p class="product-card">X</p>');
    expect(md).toContain('p.product-card');
  });

  it('skips generated classes but keeps stable ones on same element', () => {
    const md = css(
      '<p class="sc-bdVTJa emotion-abc123 price">$10</p>',
    );
    expect(md).toContain('p.price');
    expect(md).not.toContain('sc-bdVTJa');
    expect(md).not.toContain('emotion');
  });
});

// ---------------------------------------------------------------------------
// XPath
// ---------------------------------------------------------------------------

describe('XPath selectors', () => {
  it('uses //tag for simple elements', () => {
    const md = xpath('<h1>X</h1>');
    expect(md).toContain('xpath="//h1"');
  });

  it('uses stable id shortcut', () => {
    const md = xpath('<h1 id="title">X</h1>');
    expect(md).toContain("xpath=\"//h1[@id='title']\"");
  });

  it('skips dynamic id in xpath', () => {
    const md = xpath('<h1 id="item_123456">X</h1>');
    expect(md).toContain('xpath="//h1"');
    expect(md).not.toContain('123456');
  });

  it('numbers same-tag siblings', () => {
    const md = xpath('<div><p>A</p><p>B</p></div>');
    expect(md).toMatch(/\/p\[1\]/);
    expect(md).toMatch(/\/p\[2\]/);
  });

  it('omits index when sole element of its tag', () => {
    const md = xpath('<div><h2>Only</h2><p>Text</p></div>');
    expect(md).toContain('//div/h2');
    expect(md).not.toMatch(/h2\[\d\]/);
  });

  it('builds multi-level paths', () => {
    const md = xpath(
      '<div><section><h2>Deep</h2></section></div>',
    );
    expect(md).toContain('//div/section/h2');
  });
});
