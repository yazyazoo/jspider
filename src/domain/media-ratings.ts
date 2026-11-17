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
  | 'myanimelist';

export interface MediaRating {
  source: MediaRatingSource;
  label: string;
  value: string;
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
}

export interface MdbListLookupInput {
  tmdbId: number;
  mediaKind: MediaKind;
}

const sourceOrder: MediaRatingSource[] = [
  'imdb', 'tomatoes', 'popcorn', 'metacritic', 'metacriticuser',
  'letterboxd', 'trakt', 'rogerebert', 'myanimelist',
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
    const item = rawRatings.find((candidate) => candidate.source === source);
    if (!item) continue;
    const valueNumber = finiteValue(item.value);
    const url = sourceUrl(source, item, rawRatings, ids, input.mediaKind);
    if (valueNumber === null || !url) continue;
    const votes = Number.isSafeInteger(item.votes) && Number(item.votes) >= 0 ? Number(item.votes) : null;
    ratings.push({ source, label: labels[source], value: ratingValue(source, valueNumber), votes, url });
  }
  const imdb = typeof ids.imdb === 'string' && /^tt\d+$/.test(ids.imdb) ? ids.imdb : '';
  const awardsText = typeof body.awards === 'string' ? body.awards.trim() : '';
  const awards = awardsText && awardsText !== 'N/A' && imdb
    ? { text: awardsText, url: `https://www.imdb.com/title/${imdb}/awards/` }
    : null;
  return { ratings, awards };
}

