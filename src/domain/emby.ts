export type EmbyMediaKind = 'movie' | 'tv';

export interface EmbyMediaSource {
  path: string;
}

export interface EmbyItem {
  id: string;
  name: string;
  type: string;
  indexNumber?: number | null;
  productionYear: number | null;
  path: string;
  fileName?: string;
  providerIds: Record<string, string>;
  mediaSources: EmbyMediaSource[];
}

export interface EmbySeasonSummary {
  id: string;
  number: number;
  name: string;
}

export interface EmbySeriesDetails {
  seriesId: string;
  seasons: EmbySeasonSummary[];
  selectedSeasonId: string | null;
}

export type EmbyLookupInput =
  | { mode: 'tmdb'; tmdbId: number; mediaKind: EmbyMediaKind }
  | { mode: 'title'; title: string; year?: number; mediaKind: EmbyMediaKind };

export type EmbyResolutionInput =
  | { mode: 'tmdb' }
  | { mode: 'title'; title: string; year?: number };

export interface EmbyPresenceResult {
  state: 'present' | 'absent' | 'ambiguous';
  files: string[];
  series?: EmbySeriesDetails;
}

export function fileStem(path: string): string {
  const value = path.trim();
  let source = value;
  if (/^https?:\/\//i.test(value)) {
    try { source = decodeURIComponent(new URL(value).pathname); }
    catch { source = value.split('#', 1)[0] ?? value; }
  }
  const file = source.split(/[\\/]/).filter(Boolean).at(-1) ?? '';
  return file.replace(/\.[^.\\/]+$/, '');
}

function normalizedTitle(value: string): string {
  return value.normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('it')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function filenames(items: readonly EmbyItem[]): string[] {
  const names = new Set<string>();
  for (const item of items) {
    const physicalPaths = [
      item.path,
      ...item.mediaSources.map((source) => source.path),
    ];
    const paths = physicalPaths.some((path) => path.trim())
      ? physicalPaths
      : [item.fileName ?? ''];
    for (const path of paths) {
      const name = fileStem(path);
      if (name) names.add(name);
    }
  }
  return [...names];
}

export function selectDefaultEmbySeason(
  seasons: readonly EmbySeasonSummary[],
): EmbySeasonSummary | null {
  const normal = seasons.filter((season) => season.number > 0);
  const candidates = normal.length ? normal : seasons;
  return candidates.reduce<EmbySeasonSummary | null>((latest, season) =>
    latest === null || season.number > latest.number ? season : latest, null);
}

export function episodeOneFilenames(items: readonly EmbyItem[]): string[] {
  return filenames(items.filter((item) => item.indexNumber === 1));
}

export function matchingEmbyItems(
  items: readonly EmbyItem[],
  input: EmbyResolutionInput,
): EmbyItem[] {
  if (input.mode === 'tmdb') return [...items];
  const expectedTitle = normalizedTitle(input.title);
  return items.filter((item) => normalizedTitle(item.name) === expectedTitle
    && (input.year === undefined || item.productionYear === input.year));
}

export function resolveEmbyPresence(
  items: readonly EmbyItem[],
  input: EmbyResolutionInput,
): EmbyPresenceResult {
  const exact = matchingEmbyItems(items, input);
  if (exact.length === 0) return { state: 'absent', files: [] };
  return {
    state: input.mode === 'tmdb' || exact.length === 1 ? 'present' : 'ambiguous',
    files: filenames(exact),
  };
}
