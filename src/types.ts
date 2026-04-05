import type TurndownService from 'turndown';

export type AnnotationPlacement = 'inline' | 'footnote';

export type SelectorType = 'css' | 'xpath';

export type AnnotatableElement =
  | 'heading'
  | 'paragraph'
  | 'link'
  | 'image'
  | 'list'
  | 'listItem'
  | 'blockquote'
  | 'codeBlock';

export interface ScrapedownOptions {
  /** How annotations appear: 'inline' (HTML comments) or 'footnote' (references at bottom). Default: 'inline' */
  annotationPlacement?: AnnotationPlacement;
  /** Which selector types to generate. Default: ['css', 'xpath'] */
  selectors?: SelectorType[];
  /** Which element types to annotate. Default: all except 'listItem' */
  elements?: AnnotatableElement[];
  /** Options passed through to Turndown */
  turndown?: TurndownService.Options;
}

export interface SelectorResult {
  css?: string;
  xpath?: string;
}
