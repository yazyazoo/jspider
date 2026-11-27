import type { MediaKind, PageSnapshot, TechnicalInfo } from '../domain/models';

export type SearchTransportKind = 'http' | 'rendered-tab' | 'current-document';

export interface SiteDefinition {
  siteId: string;
  siteName: string;
  origins: readonly string[];
  articleMatches: readonly string[];
  searchMatches: readonly string[];
  capabilities: {
    article: boolean;
    search: boolean;
  };
  searchTransport?: SearchTransportKind;
}

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

export interface ArticleAdapter {
  id: string;
  name: string;
  patterns: string[];
  matches(url: string): boolean;
  normalizeUrl(url: string): string;
  readPage(document: Document, url: string): PageSnapshot;
  loadPage?(document: Document, url: string): Promise<PageSnapshot>;
  thankSelected?(
    document: Document,
    url: string,
    variantKeys: readonly string[],
  ): Promise<ThanksResult>;
}

export interface SearchQuery {
  title: string;
  year: string;
  mediaKind: 'movie' | 'tv';
}

export interface SearchOffer {
  offerId: string;
  siteId: string;
  articleUrl: string;
  sourceVariantKey: string;
  packageName: string;
  technical: TechnicalInfo;
  technicalCompleteness: 'complete' | 'partial' | 'unknown';
}

export interface SearchArticle {
  siteId: string;
  articleUrl: string;
  title: string;
  year: string;
  mediaKind: MediaKind;
  imdbId?: string;
  tmdbId?: number;
  offers: SearchOffer[];
}

export type SearchProviderResult =
  | { status: 'success'; articles: SearchArticle[] }
  | { status: 'empty'; articles: [] }
  | { status: 'unavailable' | 'authentication-required'; message: string };

export interface SearchProvider {
  siteId: string;
  search(query: SearchQuery): Promise<SearchProviderResult>;
}

export interface SiteModule {
  definition: SiteDefinition;
  article?: ArticleAdapter;
  search?: SearchProvider;
}
