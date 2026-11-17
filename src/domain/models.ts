import type { ArchiveHost } from './archive-links';

export type MediaKind = 'movie' | 'tv';
export type SourceCategory = 'source' | 'untouched' | 'encode' | 'unknown';
export type RecommendationProfile = '4k1080' | '1080dual' | 'manual';

export interface TechnicalInfo {
  codec: string;
  bitDepth: number | null;
  resolution: number | null;
  videoBitrate: number | null;
  overallBitrate: number | null;
  videoBytes: number | null;
  totalBytes: number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  hdr: string;
  category: SourceCategory;
  sourceFamily: string;
  provider: string;
  bitrateEstimated: boolean;
}

export interface ReleaseVariant {
  key: string;
  packageName: string;
  password: string;
  links: string[];
  linksLoaded: boolean;
  technical: TechnicalInfo;
  season?: number;
  technicalSample?: boolean;
  articleUrl?: string;
  articleId?: string;
  locked?: boolean;
  collectors?: string[];
  unsupportedCollectors?: string[];
  linkError?: string;
}

export interface PageSnapshot {
  siteId: string;
  siteName: string;
  sourceUrl: string;
  title: string;
  year: string;
  imdbId: string;
  mediaKind: MediaKind | '';
  variants: ReleaseVariant[];
  supportsThanks: boolean;
  warnings?: string[];
  thanksHint?: string;
}

export interface Recommendation {
  keys: string[];
  reasons: Record<string, string>;
  notes: string[];
  comparisons: Array<{
    resolution: number;
    key: string;
    uncertain: boolean;
    selected: boolean;
    group: string;
    season?: number | null;
  }>;
}

export interface UserSelection {
  variantKeys: string[];
  hosts: ArchiveHost[];
  profile: RecommendationProfile;
  bitrateLimitMbps: number | null;
}

