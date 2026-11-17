import { laForestaAdapter } from './laforestaincantata';
import { titanHdAdapter } from './titanhd';
import type { SiteAdapter } from './types';

export const siteAdapters: readonly SiteAdapter[] = [titanHdAdapter, laForestaAdapter];

export function resolveSiteAdapter(url: string): SiteAdapter | null {
  const matches = siteAdapters.filter((adapter) => {
    try { return adapter.matches(url); } catch { return false; }
  });
  return matches.length === 1 ? matches[0]! : null;
}

