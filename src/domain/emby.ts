export type EmbyMediaKind = 'movie' | 'tv';

export interface EmbyMediaSource {
  path: string;
}

export interface EmbyItem {
  id: string;
  name: string;
  type: string;
  productionYear: number | null;
  path: string;
  fileName?: string;
  providerIds: Record<string, string>;
  mediaSources: EmbyMediaSource[];
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
}

export function fileStem(path: string): string {
  const file = path.trim().split(/[\\/]/).filter(Boolean).at(-1) ?? '';
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
    const paths = [
      item.path,
      item.fileName ?? '',
      ...item.mediaSources.map((source) => source.path),
    ];
    for (const path of paths) {
      const name = fileStem(path);
      if (name) names.add(name);
    }
  }
  return [...names];
}

export function resolveEmbyPresence(
  items: readonly EmbyItem[],
  input: EmbyResolutionInput,
): EmbyPresenceResult {
  if (input.mode === 'tmdb') {
    return items.length
      ? { state: 'present', files: filenames(items) }
      : { state: 'absent', files: [] };
  }

  const expectedTitle = normalizedTitle(input.title);
  const exact = items.filter((item) => normalizedTitle(item.name) === expectedTitle
    && (input.year === undefined || item.productionYear === input.year));
  if (exact.length === 0) return { state: 'absent', files: [] };
  return {
    state: exact.length === 1 ? 'present' : 'ambiguous',
    files: filenames(exact),
  };
}
