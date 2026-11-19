import type { MediaKind } from './models';

export type MediaRatingSource =
  | 'imdb'
  | 'tomatoes'
  | 'popcorn'
  | 'metacritic'
  | 'metacriticuser'
  | 'letterboxd'
  | 'trakt'
  | 'rogerebert'
  | 'myanimelist'
  | 'justwatch';

export interface MediaRating {
  source: MediaRatingSource;
  label: string;
  value: string | null;
  votes: number | null;
  url: string;
}

export interface MediaAwards {
  text: string;
  url: string;
}

export interface MediaRatings {
  ratings: MediaRating[];
  awards: MediaAwards | null;
  imdbId: string | null;
}

export interface MdbListLookupInput {
  tmdbId: number;
  mediaKind: MediaKind;
  title: string;
  year: string;
}

const sourceOrder: MediaRatingSource[] = [
  'imdb', 'tomatoes', 'popcorn', 'metacritic', 'metacriticuser',
  'letterboxd', 'trakt', 'rogerebert', 'myanimelist', 'justwatch',
];

const labels: Record<MediaRatingSource, string> = {
  imdb: 'IMDb',
  tomatoes: 'Rotten Tomatoes critica',
  popcorn: 'Rotten Tomatoes pubblico',
  metacritic: 'Metacritic',
  metacriticuser: 'Metacritic utenti',
  letterboxd: 'Letterboxd',
  trakt: 'Trakt',
  rogerebert: 'Roger Ebert',
  myanimelist: 'MyAnimeList',
  justwatch: 'JustWatch',
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function relativePath(value: unknown, prefix: RegExp): string | null {
  if (typeof value !== 'string' || !prefix.test(value) || value.includes('..') || value.includes('\\')) return null;
  return value;
}

function finiteValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function textValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}

function ratingValue(source: MediaRatingSource, value: number): string {
  if (source === 'tomatoes' || source === 'popcorn' || source === 'trakt') return `${textValue(value)}%`;
  if (source === 'rogerebert') return `${textValue(value)}/4`;
  return textValue(value);
}

function searchQuery(input: MdbListLookupInput): string {
  return [input.title.trim(), input.year.trim()].filter(Boolean).join(' ');
}

function queryUrl(origin: string, pathname: string, key: string, value: string): string {
  const url = new URL(pathname, origin);
  url.searchParams.set(key, value);
  return url.toString();
}

function providerSearchUrl(source: MediaRatingSource, input: MdbListLookupInput): string {
  const query = searchQuery(input);
  if (source === 'imdb') return queryUrl('https://www.imdb.com', '/find/', 'q', query) + '&s=tt';
  if (source === 'tomatoes' || source === 'popcorn') {
    return queryUrl('https://www.rottentomatoes.com', '/search', 'search', query);
  }
  if (source === 'metacritic' || source === 'metacriticuser') {
    return `https://www.metacritic.com/search/${encodeURIComponent(query)}/`;
  }
  if (source === 'letterboxd') return `https://letterboxd.com/search/${encodeURIComponent(query)}/`;
  if (source === 'trakt') {
    return `https://trakt.tv/search/tmdb/${input.tmdbId}?id_type=${input.mediaKind === 'movie' ? 'movie' : 'show'}`;
  }
  if (source === 'rogerebert') return queryUrl('https://www.rogerebert.com', '/search', 'query', query);
  if (source === 'myanimelist') {
    const url = new URL('/anime.php', 'https://myanimelist.net');
    url.searchParams.set('q', query);
    url.searchParams.set('cat', 'anime');
    return url.toString();
  }
  return queryUrl('https://www.justwatch.com', '/it/cerca', 'q', query);
}

function sourceUrl(
  source: MediaRatingSource,
  item: Record<string, unknown>,
  ratings: Record<string, unknown>[],
  ids: Record<string, unknown>,
  mediaKind: MediaKind,
): string | null {
  const imdb = typeof ids.imdb === 'string' && /^tt\d+$/.test(ids.imdb) ? ids.imdb : '';
  if (source === 'imdb') return imdb ? `https://www.imdb.com/title/${imdb}/` : null;
  if (source === 'trakt') {
    return Number.isSafeInteger(ids.trakt) && Number(ids.trakt) > 0
      ? `https://trakt.tv/${mediaKind === 'movie' ? 'movies' : 'shows'}/${String(ids.trakt)}` : null;
  }
  if (source === 'myanimelist') {
    return Number.isSafeInteger(ids.mal) && Number(ids.mal) > 0
      ? `https://myanimelist.net/anime/${String(ids.mal)}` : null;
  }
  if (source === 'tomatoes' || source === 'popcorn') {
    const path = relativePath(item.url, /^\/(?:m|tv)\/[A-Za-z0-9._~/-]+$/);
    return path ? `https://www.rottentomatoes.com${path}` : null;
  }
  if (source === 'letterboxd') {
    const path = relativePath(item.url, /^\/film\/[A-Za-z0-9._~/-]+$/);
    return path ? `https://letterboxd.com${path}` : null;
  }
  if (source === 'metacritic' || source === 'metacriticuser') {
    const ownPath = relativePath(item.url, /^\/[A-Za-z0-9._~-]+$/);
    const critic = ratings.find((rating) => rating.source === 'metacritic');
    const criticPath = relativePath(critic?.url, /^\/[A-Za-z0-9._~-]+$/);
    const path = ownPath ?? criticPath;
    return path ? `https://www.metacritic.com/${mediaKind === 'movie' ? 'movie' : 'tv'}${path}/` : null;
  }
  if (source === 'rogerebert') {
    const slug = typeof item.url === 'string' && /^[A-Za-z0-9._~-]+$/.test(item.url) ? item.url : '';
    return slug ? `https://www.rogerebert.com/reviews/${slug}` : null;
  }
  return null;
}

export function normalizeMdbListMedia(value: unknown, input: MdbListLookupInput): MediaRatings {
  const body = record(value) ?? {};
  const ids = record(body.ids) ?? {};
  const rawRatings = Array.isArray(body.ratings)
    ? body.ratings.map(record).filter((item): item is Record<string, unknown> => item !== null)
    : [];
  const ratings: MediaRating[] = [];
  for (const source of sourceOrder) {
    const item = rawRatings.find((candidate) => candidate.source === source) ?? {};
    const valueNumber = finiteValue(item.value);
    const url = sourceUrl(source, item, rawRatings, ids, input.mediaKind)
      ?? providerSearchUrl(source, input);
    const votes = Number.isSafeInteger(item.votes) && Number(item.votes) >= 0 ? Number(item.votes) : null;
    ratings.push({
      source,
      label: labels[source],
      value: valueNumber === null ? null : ratingValue(source, valueNumber),
      votes,
      url,
    });
  }
  const imdb = typeof ids.imdb === 'string' && /^tt\d+$/.test(ids.imdb) ? ids.imdb : '';
  const awardsText = typeof body.awards === 'string' ? body.awards.trim() : '';
  const awards = awardsText && awardsText !== 'N/A' && imdb
    ? { text: awardsText, url: `https://www.imdb.com/title/${imdb}/awards/` }
    : null;
  return { ratings, awards, imdbId: imdb || null };
}

