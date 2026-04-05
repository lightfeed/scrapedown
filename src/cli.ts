import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrapedown } from './scrapedown.js';
import type { ScrapedownOptions, AnnotatableElement } from './types.js';

const HELP = `
scrapedown – HTML to Markdown with selector annotations

Usage
  scrapedown [options] [file]
  cat page.html | scrapedown [options]

Options
  -s, --selectors <type>   css, xpath, or both (default: both)
  -p, --placement <mode>   inline or footnote (default: inline)
  -e, --elements <list>    Comma-separated element types to annotate
  -h, --help               Show this help
  -v, --version            Show version number

Elements (for --elements)
  heading, paragraph, link, image, list,
  listItem, blockquote, codeBlock

Examples
  scrapedown page.html
  scrapedown -s css -p footnote page.html
  curl -s https://example.com | scrapedown
  cat page.html | scrapedown --selectors xpath
`.trim();

function getVersion(): string {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(dir, '..', 'package.json'), 'utf-8');
    return (JSON.parse(raw) as { version?: string }).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function readInput(): Promise<string> {
  if (positionals.length > 0) {
    try {
      return readFileSync(positionals[0], 'utf-8');
    } catch (err: unknown) {
      console.error(`Error reading file: ${(err as Error).message}`);
      process.exit(1);
    }
  }
  if (!process.stdin.isTTY) {
    return readStdin();
  }
  console.error(
    'No input provided. Pass a file path or pipe HTML to stdin.\n',
  );
  console.error('Run scrapedown --help for usage information.');
  process.exit(1);
}

const { values, positionals } = parseArgs({
  options: {
    selectors: { type: 'string', short: 's', default: 'both' },
    placement: { type: 'string', short: 'p', default: 'inline' },
    elements: { type: 'string', short: 'e' },
    help: { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'v', default: false },
  },
  allowPositionals: true,
  strict: true,
});

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

if (values.version) {
  console.log(getVersion());
  process.exit(0);
}

const html = await readInput();

const opts: ScrapedownOptions = {};

switch (values.selectors) {
  case 'css':
    opts.selectors = ['css'];
    break;
  case 'xpath':
    opts.selectors = ['xpath'];
    break;
  default:
    opts.selectors = ['css', 'xpath'];
}

if (values.placement === 'footnote') {
  opts.annotationPlacement = 'footnote';
}

if (values.elements) {
  opts.elements = values.elements
    .split(',')
    .map((s) => s.trim()) as AnnotatableElement[];
}

process.stdout.write(scrapedown(html, opts) + '\n');
