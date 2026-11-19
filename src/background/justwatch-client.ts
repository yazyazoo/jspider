import type { MediaKind } from '../domain/models';
import type { MediaRating } from '../domain/media-ratings';

type Fetcher = (request: Request) => Promise<Response>;

export interface JustWatchLookupInput {
  tmdbId: number;
  mediaKind: MediaKind;
  title: string;
  year: string;
  imdbId: string | null;
}

const query = `query GetRating($country: Country!, $language: Language!, $query: String!) {
  popularTitles(country: $country, filter: {searchQuery: $query}, first: 10) {
    edges {
      node {
        id
        objectType
        content(country: $country, language: $language) {
          title
          originalReleaseYear
          fullPath
          externalIds { imdbId }
          scoring { jwRating }
        }
      }
    }
  }
}`;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function normalize(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim()
    : '';
}

function safeUrl(path: unknown, mediaKind: MediaKind): string | null {
  if (typeof path !== 'string' || !path.startsWith('/it/')) return null;
  const prefix = mediaKind === 'movie' ? '/it/film/' : '/it/serie-tv/';
  try {
    const url = new URL(path, 'https://www.justwatch.com');
    return url.origin === 'https://www.justwatch.com'
      && url.pathname.startsWith(prefix)
      && !url.username && !url.password && !url.search && !url.hash
      ? url.toString() : null;
  } catch {
    return null;
  }
}

interface Candidate {
  objectType: string;
  title: string;
  year: number;
  fullPath: unknown;
  imdbId: string;
  rating: number | null;
}

function candidates(value: unknown): Candidate[] {
  const body = record(value);
  const data = record(body?.data);
  const popular = record(data?.popularTitles);
  const edges = Array.isArray(popular?.edges) ? popular.edges : [];
  return edges.flatMap((edge): Candidate[] => {
    const node = record(record(edge)?.node);
    const content = record(node?.content);
    const externalIds = record(content?.externalIds);
    const scoring = record(content?.scoring);
    if (!node || !content || typeof node.objectType !== 'string'
      || typeof content.title !== 'string' || !Number.isInteger(content.originalReleaseYear)) return [];
    const rawRating = scoring?.jwRating;
    return [{
      objectType: node.objectType,
      title: content.title,
      year: Number(content.originalReleaseYear),
      fullPath: content.fullPath,
      imdbId: typeof externalIds?.imdbId === 'string' ? externalIds.imdbId : '',
      rating: typeof rawRating === 'number' && Number.isFinite(rawRating)
        && rawRating >= 0 && rawRating <= 1 ? rawRating : null,
    }];
  });
}

export class JustWatchClient {
  readonly #fetcher: Fetcher;

  constructor(fetcher: Fetcher = (request) => fetch(request)) {
    this.#fetcher = fetcher;
  }

  async lookup(input: JustWatchLookupInput): Promise<MediaRating | null> {
    const title = input.title.trim();
    if (!title || !/^\d{4}$/.test(input.year)) return null;
    const request = new Request('https://apis.justwatch.com/graphql', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { country: 'IT', language: 'it', query: title },
      }),
    });
    const response = await this.#fetcher(request);
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new Error('JustWatch ha restituito JSON non valido.'); }
    if (!response.ok) throw new Error(`JustWatch ha risposto HTTP ${response.status}.`);

    const expectedType = input.mediaKind === 'movie' ? 'MOVIE' : 'SHOW';
    const typed = candidates(body).filter((candidate) => candidate.objectType === expectedType);
    const validImdb = typeof input.imdbId === 'string' && /^tt\d+$/.test(input.imdbId)
      ? input.imdbId : '';
    const imdbMatches = validImdb ? typed.filter((candidate) => candidate.imdbId === validImdb) : [];
    if (imdbMatches.length > 1) return null;
    const titleMatches = typed.filter((candidate) => normalize(candidate.title) === normalize(title)
      && candidate.year === Number(input.year));
    const selected = imdbMatches[0] ?? (titleMatches.length === 1 ? titleMatches[0] : null);
    if (!selected) return null;
    const url = safeUrl(selected.fullPath, input.mediaKind);
    if (!url) return null;
    return {
      source: 'justwatch',
      label: 'JustWatch',
      value: selected.rating === null ? null : `${Math.round(selected.rating * 100)}%`,
      votes: null,
      url,
    };
  }
}
