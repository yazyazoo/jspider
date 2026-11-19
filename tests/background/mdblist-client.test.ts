import { describe, expect, it } from 'vitest';
import { MdbListClient } from '../../src/background/mdblist-client';

const movieInput = { tmdbId: 1, mediaKind: 'movie' as const, title: 'Alien', year: '1979' };

describe('MdbListClient', () => {
  it('looks up movies and shows by TMDB id using the required query API key', async () => {
    const requests: Request[] = [];
    const client = new MdbListClient('mdb-secret', async (request) => {
      requests.push(request);
      return new Response(JSON.stringify({ ratings: [] }), { status: 200 });
    });

    await client.lookup({ ...movieInput, tmdbId: 872585 });
    await client.lookup({ ...movieInput, tmdbId: 76331, mediaKind: 'tv' });

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      '/tmdb/movie/872585/', '/tmdb/show/76331/',
    ]);
    expect(requests.every((request) => new URL(request.url).searchParams.get('apikey') === 'mdb-secret')).toBe(true);
    expect(requests.every((request) => !request.headers.has('authorization'))).toBe(true);
  });

  it('redacts the API key from network and HTTP errors', async () => {
    const network = new MdbListClient('mdb-secret', async () => {
      throw new Error('failed mdb-secret');
    });
    await expect(network.lookup(movieInput))
      .rejects.toThrow('failed [redacted]');

    const http = new MdbListClient('mdb-secret', async () => new Response(
      JSON.stringify({ error: 'invalid mdb-secret' }), { status: 401 },
    ));
    await expect(http.lookup(movieInput))
      .rejects.toThrow('invalid [redacted]');
  });

  it('rejects malformed JSON and invalid lookup input', async () => {
    const client = new MdbListClient('mdb-secret', async () => new Response('not json'));
    await expect(client.lookup({ ...movieInput, tmdbId: 0 }))
      .rejects.toThrow('ID TMDB');
    await expect(client.lookup(movieInput))
      .rejects.toThrow('JSON');
  });
});

