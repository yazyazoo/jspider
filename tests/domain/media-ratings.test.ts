import { describe, expect, it } from 'vitest';
import { normalizeMdbListMedia } from '../../src/domain/media-ratings';

describe('normalizeMdbListMedia', () => {
  it('normalizes every supported clickable source and IMDb-linked awards', () => {
    const result = normalizeMdbListMedia({
      ids: { imdb: 'tt15398776', trakt: 698292, mal: 5114 },
      awards: 'Won 7 Oscars. 370 wins & 378 nominations total',
      ratings: [
        { source: 'imdb', value: 8.2, votes: 1112537, url: 143 },
        { source: 'metacritic', value: 90, votes: 69, url: '/oppenheimer' },
        { source: 'metacriticuser', value: 8.4, votes: 2289, url: null },
        { source: 'trakt', value: 83, votes: 54590, url: null },
        { source: 'tomatoes', value: 93, votes: 510, url: '/m/oppenheimer_2023' },
        { source: 'popcorn', value: 91, votes: 10000, url: '/m/oppenheimer_2023' },
        { source: 'letterboxd', value: 4.2, votes: 4758594, url: '/film/oppenheimer-2023/' },
        { source: 'rogerebert', value: 4, votes: null, url: 'oppenheimer-film-review-2023' },
        { source: 'myanimelist', value: 8.7, votes: 3000, url: null },
      ],
    }, { tmdbId: 872585, mediaKind: 'movie', title: 'Oppenheimer', year: '2023' });

    expect(result.ratings.map(({ source, value, url }) => ({ source, value, url }))).toEqual([
      { source: 'imdb', value: '8.2', url: 'https://www.imdb.com/title/tt15398776/' },
      { source: 'tomatoes', value: '93%', url: 'https://www.rottentomatoes.com/m/oppenheimer_2023' },
      { source: 'popcorn', value: '91%', url: 'https://www.rottentomatoes.com/m/oppenheimer_2023' },
      { source: 'metacritic', value: '90', url: 'https://www.metacritic.com/movie/oppenheimer/' },
      { source: 'metacriticuser', value: '8.4', url: 'https://www.metacritic.com/movie/oppenheimer/' },
      { source: 'letterboxd', value: '4.2', url: 'https://letterboxd.com/film/oppenheimer-2023/' },
      { source: 'trakt', value: '83%', url: 'https://trakt.tv/movies/698292' },
      { source: 'rogerebert', value: '4/4', url: 'https://www.rogerebert.com/reviews/oppenheimer-film-review-2023' },
      { source: 'myanimelist', value: '8.7', url: 'https://myanimelist.net/anime/5114' },
      { source: 'justwatch', value: null, url: 'https://www.justwatch.com/it/cerca?q=Oppenheimer+2023' },
    ]);
    expect(result.awards).toEqual({
      text: 'Won 7 Oscars. 370 wins & 378 nominations total',
      url: 'https://www.imdb.com/title/tt15398776/awards/',
    });
    expect(result.imdbId).toBe('tt15398776');
  });

  it('keeps every provider link when ratings and direct URLs are missing', () => {
    const result = normalizeMdbListMedia({
      ids: {}, awards: 'N/A', ratings: [
        { source: 'tomatoes', value: null, url: '/m/example' },
        { source: 'popcorn', value: Number.NaN, url: '/m/example' },
        { source: 'unknown', value: 100, url: 'https://example.test' },
      ],
    }, { tmdbId: 1, mediaKind: 'tv', title: 'Example', year: '2026' });

    expect(result.ratings.map(({ source, value, url }) => ({ source, value, url }))).toEqual([
      { source: 'imdb', value: null, url: 'https://www.imdb.com/find/?q=Example+2026&s=tt' },
      { source: 'tomatoes', value: null, url: 'https://www.rottentomatoes.com/m/example' },
      { source: 'popcorn', value: null, url: 'https://www.rottentomatoes.com/m/example' },
      { source: 'metacritic', value: null, url: 'https://www.metacritic.com/search/Example%202026/' },
      { source: 'metacriticuser', value: null, url: 'https://www.metacritic.com/search/Example%202026/' },
      { source: 'letterboxd', value: null, url: 'https://letterboxd.com/search/Example%202026/' },
      { source: 'trakt', value: null, url: 'https://trakt.tv/search/tmdb/1?id_type=show' },
      { source: 'rogerebert', value: null, url: 'https://www.rogerebert.com/search?query=Example+2026' },
      { source: 'myanimelist', value: null, url: 'https://myanimelist.net/anime.php?q=Example+2026&cat=anime' },
      { source: 'justwatch', value: null, url: 'https://www.justwatch.com/it/cerca?q=Example+2026' },
    ]);
    expect(result.awards).toBeNull();
    expect(result.imdbId).toBeNull();
  });

  it('uses TV-specific Metacritic and Trakt content URLs', () => {
    const result = normalizeMdbListMedia({
      ids: { trakt: 125479 }, ratings: [
        { source: 'metacritic', value: 86, url: '/succession' },
        { source: 'trakt', value: 87 },
      ],
    }, { tmdbId: 76331, mediaKind: 'tv', title: 'Succession', year: '2018' });

    expect(result.ratings.find((rating) => rating.source === 'metacritic')?.url)
      .toBe('https://www.metacritic.com/tv/succession/');
    expect(result.ratings.find((rating) => rating.source === 'trakt')?.url)
      .toBe('https://trakt.tv/shows/125479');
  });
});

