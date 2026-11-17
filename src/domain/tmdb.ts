import type { MediaKind } from './models';

export interface TmdbCandidate {
  id: number;
  mediaKind: MediaKind;
  title: string;
  year: string;
  overview: string;
  poster: string;
  url: string;
  imdbUrl: string;
}

export interface TmdbSearchInput {
  title: string;
  year: string;
  mediaKind: MediaKind;
  imdbId: string;
  mode: 'auto' | 'title';
}

export type TmdbRequest = (
  path: string,
  params: Record<string, unknown>,
) => Promise<unknown>;

export interface TmdbSearchResult {
  method: 'imdb' | 'title';
  candidates: TmdbCandidate[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function candidate(value: unknown, mediaKind: MediaKind, imdbUrl = ''): TmdbCandidate | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.id) || Number(value.id) <= 0) return null;
  const title = String(value.title ?? value.name ?? '');
  const date = String(value.release_date ?? value.first_air_date ?? '');
  const posterPath = typeof value.poster_path === 'string' && /^\/[A-Za-z0-9._-]+$/.test(value.poster_path)
    ? value.poster_path : '';
  return {
    id: Number(value.id), mediaKind, title, year: date.slice(0, 4),
    overview: String(value.overview ?? ''),
    poster: posterPath ? `https://image.tmdb.org/t/p/w185${posterPath}` : '',
    url: `https://www.themoviedb.org/${mediaKind}/${String(value.id)}`,
    imdbUrl,
  };
}

function imdbSearchUrl(item: Pick<TmdbCandidate, 'title' | 'year'>, fallbackYear: string): string {
  const url = new URL('https://www.imdb.com/find/');
  url.searchParams.set('q', [item.title, item.year || fallbackYear].filter(Boolean).join(' '));
  url.searchParams.set('s', 'tt');
  return url.toString();
}

function arrayField(value: unknown, key: string): unknown[] {
  return isRecord(value) && Array.isArray(value[key]) ? value[key] : [];
}

async function fillMissingEnglishOverviews(
  candidates: TmdbCandidate[],
  request: TmdbRequest,
): Promise<TmdbCandidate[]> {
  return Promise.all(candidates.map(async (item) => {
    if (item.overview.trim()) return item;
    try {
      const details = await request(`/${item.mediaKind}/${item.id}`, { language: 'en-US' });
      const overview = isRecord(details) && typeof details.overview === 'string'
        ? details.overview.trim() : '';
      return overview ? { ...item, overview } : item;
    } catch {
      return item;
    }
  }));
}

export async function searchTmdb(
  input: TmdbSearchInput,
  request: TmdbRequest,
): Promise<TmdbSearchResult> {
  const title = input.title.trim();
  const year = input.year.trim();
  if (!title || title.length > 200) throw new Error('Inserisci un titolo di massimo 200 caratteri.');
  if (year && !/^\d{4}$/.test(year)) throw new Error('Inserisci un anno di quattro cifre oppure lascialo vuoto.');

  if (input.mode === 'auto' && /^tt\d+$/.test(input.imdbId)) {
    const found = await request(`/find/${input.imdbId}`, {
      external_source: 'imdb_id', language: 'it-IT',
    });
    const key = input.mediaKind === 'movie' ? 'movie_results' : 'tv_results';
    const candidates = arrayField(found, key)
      .map((item) => candidate(
        item,
        input.mediaKind,
        `https://www.imdb.com/title/${input.imdbId}/`,
      ))
      .filter((item): item is TmdbCandidate => item !== null);
    if (candidates.length === 1) {
      return { method: 'imdb', candidates: await fillMissingEnglishOverviews(candidates, request) };
    }
  }

  const params: Record<string, unknown> = {
    query: title, language: 'it-IT', page: 1, include_adult: false,
  };
  if (year) params[input.mediaKind === 'tv' ? 'first_air_date_year' : 'year'] = year;
  const found = await request(`/search/${input.mediaKind}`, params);
  const candidates = arrayField(found, 'results')
    .map((item) => candidate(item, input.mediaKind))
    .filter((item): item is TmdbCandidate => item !== null)
    .slice(0, 10)
    .map((item) => ({ ...item, imdbUrl: imdbSearchUrl(item, year) }));
  return { method: 'title', candidates: await fillMissingEnglishOverviews(candidates, request) };
}

