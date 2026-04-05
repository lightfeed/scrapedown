# scrapedown

HTML to Markdown with CSS selector and XPath annotations — built for LLM-powered web scraping.

[![CI](https://github.com/lightfeed/scrapedown/actions/workflows/ci.yml/badge.svg)](https://github.com/lightfeed/scrapedown/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@lightfeed/scrapedown)](https://www.npmjs.com/package/@lightfeed/scrapedown)
[![license](https://img.shields.io/npm/l/@lightfeed/scrapedown)](./LICENSE)

## Why?

HTML-to-Markdown converters produce clean, readable text — but the DOM structure is lost. When you feed that Markdown to an LLM to build a scraper, it has no idea *how* to target specific elements on the page.

**scrapedown** solves this by annotating each Markdown element with its CSS selector and/or XPath. The LLM can then generate precise, token-efficient scraper code that uses selectors instead of relying on fragile text matching.

```
Traditional pipeline:          HTML → Markdown → LLM → (guesses selectors)
With scrapedown:     HTML → Annotated Markdown → LLM → accurate scraper code
```

## Install

```bash
npm install @lightfeed/scrapedown
```

## Quick start

```typescript
import { scrapedown } from '@lightfeed/scrapedown';

const html = `
<div class="product">
  <h1 class="title">Widget Pro</h1>
  <p class="price">$29.99</p>
  <ul class="features">
    <li>Lightweight</li>
    <li>Durable</li>
  </ul>
  <a href="/buy" class="cta">Buy Now</a>
</div>`;

console.log(scrapedown(html));
```

**Output:**

```markdown
# Widget Pro
<!-- css="div.product > h1.title" xpath="//div/h1" -->

$29.99
<!-- css="div.product > p.price" xpath="//div/p" -->

- Lightweight
- Durable
<!-- css="div.product > ul.features" xpath="//div/ul" -->

[Buy Now](/buy)<!-- css="div.product > a.cta" xpath="//div/a" -->
```

An LLM receiving this output can immediately generate scraper code:

```javascript
const title = document.querySelector('div.product > h1.title').textContent;
const price = document.querySelector('div.product > p.price').textContent;
const features = [...document.querySelectorAll('div.product > ul.features > li')]
  .map(li => li.textContent);
```

## CLI

### Running the CLI

**Via npx (no install needed):**

```bash
npx @lightfeed/scrapedown page.html
```

**Global install:**

```bash
npm install -g @lightfeed/scrapedown
scrapedown page.html
```

**Pipe HTML from any source:**

```bash
curl -s https://example.com | npx @lightfeed/scrapedown
cat page.html | npx @lightfeed/scrapedown
```

### CLI options

```
Usage
  scrapedown [options] [file]
  cat page.html | scrapedown [options]

Options
  -s, --selectors <type>   css, xpath, or both (default: both)
  -p, --placement <mode>   inline or footnote (default: inline)
  -e, --elements <list>    Comma-separated element types to annotate
  -h, --help               Show this help
  -v, --version            Show version number
```

### Real-world example: Hacker News

```bash
curl -s https://news.ycombinator.com | npx @lightfeed/scrapedown -s css
```

Output (trimmed):

```
1.

[Introduction to Computer Music (2009) [pdf]](https://composerprogrammer.com/introductiontocomputermusic.pdf)
<!-- css="span.titleline > a" -->
([composerprogrammer.com](from?site=composerprogrammer.com)<!-- css="span.sitebit.comhead > a" -->)

107 points by [luu](user?id=luu)<!-- css="span.subline > a.hnuser" -->
[4 hours ago](item?id=47645432)<!-- css="span.age > a" -->
| [26 comments](item?id=47645432)<!-- css="span.subline > a:nth-of-type(3)" -->

2.

[Show HN: A game where you build a GPU](https://jaso1024.com/mvidia/)
<!-- css="span.titleline > a" -->
...
```

An LLM reading this can immediately produce a working scraper:

```javascript
// Selectors learned from scrapedown output
const stories = document.querySelectorAll('span.titleline > a');
const scores = document.querySelectorAll('span.subline > span.score');
const commentLinks = document.querySelectorAll('span.subline > a:last-of-type');
```

## API

### `scrapedown(html, options?)`

Convert HTML to annotated Markdown in one call.

```typescript
import { scrapedown } from '@lightfeed/scrapedown';
const md = scrapedown('<h1>Hello</h1>');
```

### `new Scrapedown(options?)`

Create a reusable converter instance (avoids re-creating Turndown rules on every call).

```typescript
import { Scrapedown } from '@lightfeed/scrapedown';

const sd = new Scrapedown({ selectors: ['css'] });
const md = sd.convert(html);
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `annotationPlacement` | `'inline' \| 'footnote'` | `'inline'` | `inline` emits HTML comments next to each element. `footnote` appends `[^sN]` references with details at the bottom. |
| `selectors` | `('css' \| 'xpath')[]` | `['css', 'xpath']` | Which selector types to include in annotations. |
| `elements` | `AnnotatableElement[]` | All except `listItem` | Which element types to annotate. Options: `heading`, `paragraph`, `link`, `image`, `list`, `listItem`, `blockquote`, `codeBlock`. |
| `turndown` | `TurndownService.Options` | `{}` | Options forwarded to [Turndown](https://github.com/mixmark-io/turndown). |

### Annotation modes

**Inline** (default) — HTML comments that are invisible in rendered Markdown:

```markdown
# Title
<!-- css="h1.title" xpath="//h1" -->
```

**Footnote** — compact references with a selector table at the bottom:

```markdown
# Title[^s1]

---

[^s1]: css: `h1.title` | xpath: `//h1`
```

### Exported utilities

The selector generators are also exported for direct use:

```typescript
import { computeCSSSelector, computeXPath } from '@lightfeed/scrapedown';
```

## How selectors are generated

**CSS selectors** use the shortest stable path:

1. `#id` if the element has one
2. `tag[data-testid="…"]` for test IDs
3. `tag.class1.class2` with ancestor chain (max 3 classes, max 5 levels)
4. `:nth-of-type(n)` when same-tag siblings exist

**XPath** builds a positional path from `<body>`, short-circuiting at any ancestor with an `id`.

## Contributing

```bash
git clone https://github.com/lightfeed/scrapedown.git
cd scrapedown
npm install
npm test            # run tests
npm run test:watch  # watch mode
npm run build       # build for distribution
```

## License

[MIT](./LICENSE)
