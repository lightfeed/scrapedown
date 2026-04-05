import { describe, it, expect } from 'vitest';
import { Scrapedown } from '../src/index.js';

/**
 * Selector tests via the full conversion pipeline.
 * We use CSS-only mode to keep assertions simple.
 */
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
// CSS Selector specifics
// ---------------------------------------------------------------------------

describe('CSS selectors', () => {
  it('prefers id over everything else', () => {
    const md = css('<h1 id="hero" class="big shiny">X</h1>');
    expect(md).toContain('css="#hero"');
    expect(md).not.toContain('h1.big');
  });

  it('caps classes at 3', () => {
    const md = css('<p class="a b c d e">Hi</p>');
    expect(md).toContain('p.a.b.c');
    expect(md).not.toContain('.d');
  });

  it('uses ancestor id as root', () => {
    const md = css(
      '<div id="app"><section><h2 class="sub">S</h2></section></div>',
    );
    expect(md).toMatch(/#app/);
  });

  it('handles no class, no id', () => {
    const md = css('<h1>Plain</h1>');
    expect(md).toContain('css="h1"');
  });

  it('handles nested same-tag elements', () => {
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
});

// ---------------------------------------------------------------------------
// XPath specifics
// ---------------------------------------------------------------------------

describe('XPath selectors', () => {
  it('uses //tag for simple elements', () => {
    const md = xpath('<h1>X</h1>');
    expect(md).toContain('xpath="//h1"');
  });

  it('uses id shortcut', () => {
    const md = xpath('<h1 id="title">X</h1>');
    expect(md).toContain("xpath=\"//h1[@id='title']\"");
  });

  it('numbers same-tag siblings', () => {
    const md = xpath('<div><p>A</p><p>B</p></div>');
    expect(md).toMatch(/\/p\[1\]/);
    expect(md).toMatch(/\/p\[2\]/);
  });

  it('builds multi-level paths', () => {
    const md = xpath(
      '<div><section><h2>Deep</h2></section></div>',
    );
    expect(md).toContain('//div/section/h2');
  });
});
