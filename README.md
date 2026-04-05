# Scrapedown

HTML to Markdown with CSS selector and XPath annotations — built for LLM-powered web scraping.

[![CI](https://github.com/lightfeed/scrapedown/actions/workflows/ci.yml/badge.svg)](https://github.com/lightfeed/scrapedown/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@lightfeed/scrapedown)](https://www.npmjs.com/package/@lightfeed/scrapedown)
[![license](https://img.shields.io/npm/l/@lightfeed/scrapedown)](./LICENSE)

## Why?

HTML-to-Markdown converters produce clean, readable content for both humans and LLMs — but the DOM structure is lost along the way. You can always feed Markdown to an LLM to extract structured information, but that costs tokens on every page, every time.

What if the LLM could also see *where* each piece of content lives in the DOM? Then it can generate robust scraping code — stable selectors and XPaths that run without any LLM in the loop, saving tokens and improving accuracy on long or repetitive pages.

**Scrapedown** does exactly this: it converts HTML to Markdown and annotates each element with its CSS selector and/or XPath, so an LLM can produce precise, reusable scraper code in one shot.

```
Traditional:     HTML → Markdown → LLM extracts data (every time, costs tokens)
With scrapedown: HTML → Annotated Markdown → LLM generates scraper (once)
                                           → scraper runs without LLM
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
curl -s https://example.com | npx @lightfeed/scrapedown
```

**Global install:**

```bash
npm install -g @lightfeed/scrapedown
scrapedown page.html
```

**Local development (before publishing):**

```bash
# From the project directory
npm run build
npx . page.html
curl -s https://example.com | npx .

# Or link globally for the "scrapedown" command
npm link
scrapedown page.html
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
curl -s https://news.ycombinator.com | npx @lightfeed/scrapedown
```

Output (trimmed):

```
1.

[Gemma 4 on iPhone](https://apps.apple.com/nl/app/google-ai-edge-gallery/id6749645337)
<!-- css="span.titleline > a" xpath="//tr[@id='bigbox']/td/table/tbody/tr[1]/td[3]/span/a" -->
([apps.apple.com](from?site=apps.apple.com)<!-- css="span.sitebit.comhead > a" -->)

329 points by [janandonly](user?id=janandonly)<!-- css="span.subline > a.hnuser" -->
[4 hours ago](item?id=47652561)<!-- css="span.age > a" -->
| [hide](hide?id=47652561&goto=news)<!-- css="span.subline > a:nth-of-type(2)" -->
| [84 comments](item?id=47652561)<!-- css="span.subline > a:nth-of-type(3)" -->

2.

[In Japan, the robot isn't coming for your job; it's filling the one nobody wants](https://techcrunch.com/...)
<!-- css="span.titleline > a" xpath="//tr[@id='bigbox']/td/table/tbody/tr[4]/td[3]/span/a" -->
...
```

An LLM reading this can immediately produce a working scraper:

```javascript
const stories = document.querySelectorAll('span.titleline > a');
const users = document.querySelectorAll('span.subline > a.hnuser');
const commentLinks = document.querySelectorAll('span.subline > a:nth-of-type(3)');
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

### Custom Turndown rules

The underlying `TurndownService` instance is exposed via `sd.service`, so you can add custom rules, remove elements, or use Turndown plugins:

```typescript
import { Scrapedown } from '@lightfeed/scrapedown';

const sd = new Scrapedown();

// Remove scripts, styles, and other irrelevant elements
sd.service.addRule('remove-irrelevant', {
  filter: ['script', 'style', 'noscript', 'meta', 'link', 'textarea'],
  replacement: () => '',
});

// Strip SVGs
sd.service.addRule('remove-svg', {
  filter: 'svg',
  replacement: () => '',
});

// Promote <title> to an h1
sd.service.addRule('title-as-h1', {
  filter: ['title'],
  replacement: (innerText) => `${innerText}\n===============\n`,
});

const md = sd.convert(html);
```

### Exported utilities

The selector generators are also exported for direct use:

```typescript
import { computeCSSSelector, computeXPath } from '@lightfeed/scrapedown';
```

## How selectors are generated

Selectors are ranked by **stability** — how likely they are to survive across page loads, different content, and site redesigns. Dynamic IDs, CSS-in-JS hashes, and framework-generated attributes are automatically filtered out.

**CSS selector priority** (most → least stable):

| Priority | Strategy | Example | Why |
|---|---|---|---|
| 1 | `data-testid` | `h1[data-testid="title"]` | Explicitly placed for testing, rarely changes |
| 2 | Unique stable classes | `span.titleline > a` | Structural, works across pages |
| 3 | Stable ID | `#main-content` | Only if human-written and reusable |
| 4 | `tag:nth-of-type(n)` | `li:nth-of-type(3)` | Positional fallback |

**Filtered out automatically:**

| Pattern | Example | Why it's fragile |
|---|---|---|
| Long digit sequences | `id="item_123456"` | Per-item, changes every page |
| UUIDs | `id="a1b2c3d4-e5f6-..."` | Session/instance-specific |
| Framework prefixes | `id="__next_abc"`, `id=":r0:"` | React/Next.js internals |
| CSS-in-JS classes | `class="css-1abc2de"` | Build-generated, changes on deploy |
| CSS modules hashes | `class="Header_a3f2b1"` | Hash changes with content |

**XPath** builds a positional path from `<body>`, short-circuiting at any ancestor with a stable `id`.

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
