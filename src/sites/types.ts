import type { PageSnapshot } from '../domain/models';

export interface ThanksFailure {
  key: string;
  error: string;
}

export interface ThanksResult {
  context: PageSnapshot;
  thanks: {
    thanked: string[];
    already: string[];
    failed: ThanksFailure[];
    replacements?: Record<string, string[]>;
  };
}

export interface SiteAdapter {
  id: string;
  name: string;
  patterns: string[];
  matches(url: string): boolean;
  normalizeUrl(url: string): string;
  readPage(document: Document, url: string): PageSnapshot;
  loadPage?(document: Document, url: string): Promise<PageSnapshot>;
  thankSelected?(document: Document, url: string, variantKeys: readonly string[]): Promise<ThanksResult>;
}

