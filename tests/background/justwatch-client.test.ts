import { describe, expect, it } from 'vitest';
import { JustWatchClient } from '../../src/background/justwatch-client';

const alien = {
  id: 'tm72398',
  objectType: 'MOVIE',
  content: {
    title: 'Alien',
    originalReleaseYear: 1979,
    fullPath: '/it/film/alien',
    externalIds: { imdbId: 'tt0078748' },
    scoring: { jwRating: 0.970576782193 },
  },
};

function response(edges: unknown[]): Response {
  return new Response(JSON.stringify({ data: { popularTitles: { edges: edges.map((node) => ({ node })) } } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('JustWatchClient', () => {
  it('prefers the exact IMDb match and returns the Italian direct link and rounded rating', async () => {
    const captured: Request[] = [];
    const client = new JustWatchClient(async (request) => {
      captured.push(request);
      return response([
        { ...alien, id: 'tm-wrong', content: { ...alien.content, externalIds: { imdbId: 'tt9999999' } } },
        alien,
      ]);
    });

    await expect(client.lookup({
      tmdbId: 348,
      mediaKind: 'movie',
      title: 'Alien',
      year: '1979',
      imdbId: 'tt0078748',
    })).resolves.toEqual({
      source: 'justwatch',
      label: 'JustWatch',
      value: '97%',
      votes: null,
      url: 'https://www.justwatch.com/it/film/alien',
    });

    expect(captured[0]?.url).toBe('https://apis.justwatch.com/graphql');
    expect(captured[0]?.method).toBe('POST');
    const payload = JSON.parse(await captured[0]!.clone().text()) as Record<string, unknown>;
    expect(payload.variables).toEqual({ country: 'IT', language: 'it', query: 'Alien' });
  });

  it('uses one exact media type, title and year match when IMDb is unavailable', async () => {
    const client = new JustWatchClient(async () => response([
      { ...alien, id: 'ts-wrong', objectType: 'SHOW' },
      { ...alien, id: 'tm-wrong-year', content: { ...alien.content, originalReleaseYear: 1980 } },
      alien,
    ]));

    const result = await client.lookup({
      tmdbId: 348, mediaKind: 'movie', title: 'Alien', year: '1979', imdbId: null,
    });
    expect(result?.url).toBe('https://www.justwatch.com/it/film/alien');
  });

  it('returns null for ambiguous exact matches', async () => {
    const client = new JustWatchClient(async () => response([alien, { ...alien, id: 'tm-other' }]));
    await expect(client.lookup({
      tmdbId: 348, mediaKind: 'movie', title: 'Alien', year: '1979', imdbId: null,
    })).resolves.toBeNull();
  });

  it('keeps a safe direct link without inventing a missing rating', async () => {
    const client = new JustWatchClient(async () => response([{
      ...alien,
      content: { ...alien.content, scoring: { jwRating: null } },
    }]));
    await expect(client.lookup({
      tmdbId: 348, mediaKind: 'movie', title: 'Alien', year: '1979', imdbId: 'tt0078748',
    })).resolves.toMatchObject({ value: null, url: 'https://www.justwatch.com/it/film/alien' });
  });

  it('rejects a matched result whose path is outside the Italian JustWatch catalog', async () => {
    const client = new JustWatchClient(async () => response([{
      ...alien,
      content: { ...alien.content, fullPath: 'https://attacker.test/alien' },
    }]));
    await expect(client.lookup({
      tmdbId: 348, mediaKind: 'movie', title: 'Alien', year: '1979', imdbId: 'tt0078748',
    })).resolves.toBeNull();
  });
});
