import { describe, expect, it } from 'vitest';
import { searchTmdb } from '../../src/domain/tmdb';

describe('searchTmdb', () => {
  it('uses IMDb first but still returns an unvalidated candidate', async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const result = await searchTmdb({
      title: 'Film', year: '2026', mediaKind: 'movie', imdbId: 'tt36583977', mode: 'auto',
    }, async (path, params) => {
      calls.push([path, params]);
      return { movie_results: [{
        id: 1465063, title: 'Forgotten Island', release_date: '2026-09-10',
        overview: 'Trama', poster_path: '/poster.jpg',
      }] };
    });
    expect(calls[0]?.[0]).toBe('/find/tt36583977');
    expect(result).toEqual({ method: 'imdb', candidates: [{
      id: 1465063, mediaKind: 'movie', title: 'Forgotten Island', year: '2026',
      overview: 'Trama', poster: 'https://image.tmdb.org/t/p/w185/poster.jpg',
      url: 'https://www.themoviedb.org/movie/1465063',
      imdbUrl: 'https://www.imdb.com/title/tt36583977/',
    }] });
    expect(result).not.toHaveProperty('validated');
  });

  it('fills a missing Italian overview from the English TMDB details', async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const result = await searchTmdb({
      title: 'Sleep', year: '2023', mediaKind: 'movie', imdbId: 'tt8209702', mode: 'auto',
    }, async (path, params) => {
      calls.push([path, params]);
      if (path === '/find/tt8209702') {
        return { movie_results: [{
          id: 964592, title: 'Sleep', release_date: '2023-09-06',
          overview: '', poster_path: '/sleep.jpg',
        }] };
      }
      if (path === '/movie/964592') {
        return { id: 964592, overview: "A pregnant wife's sleepwalking takes a disturbing turn." };
      }
      throw new Error(`Richiesta inattesa: ${path}`);
    });

    expect(calls).toEqual([
      ['/find/tt8209702', { external_source: 'imdb_id', language: 'it-IT' }],
      ['/movie/964592', { language: 'en-US' }],
    ]);
    expect(result.candidates[0]?.overview)
      .toBe("A pregnant wife's sleepwalking takes a disturbing turn.");
  });

  it('falls back to title/year for missing or ambiguous IMDb matches and caps results at ten', async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const result = await searchTmdb({
      title: 'Film', year: '2026', mediaKind: 'movie', imdbId: 'tt36583977', mode: 'auto',
    }, async (path, params) => {
      calls.push([path, params]);
      if (path.startsWith('/find/')) return { movie_results: [] };
      return { results: Array.from({ length: 15 }, (_, index) => ({ id: index + 1, title: `Film ${index}` })) };
    });
    expect(calls[1]).toEqual(['/search/movie', {
      query: 'Film', language: 'it-IT', page: 1, include_adult: false, year: '2026',
    }]);
    expect(result.method).toBe('title');
    expect(result.candidates).toHaveLength(10);
    expect(result.candidates[0]?.imdbUrl)
      .toBe('https://www.imdb.com/find/?q=Film+0+2026&s=tt');
  });

  it('lets a refined TV search bypass IMDb and uses first_air_date_year', async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    await searchTmdb({
      title: 'Serie', year: '2024', mediaKind: 'tv', imdbId: 'tt1234567', mode: 'title',
    }, async (path, params) => { calls.push([path, params]); return { results: [] }; });
    expect(calls).toEqual([['/search/tv', {
      query: 'Serie', language: 'it-IT', page: 1, include_adult: false,
      first_air_date_year: '2024',
    }]]);
  });
});

