import { describe, expect, it, vi } from 'vitest';
import { OmdbClient } from '../../src/background/omdb-client';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
}

describe('OmdbClient', () => {
  it('loads awards by IMDb ID and links to the IMDb awards page', async () => {
    const requests: Request[] = [];
    const client = new OmdbClient('omdb-secret', async (request) => {
      requests.push(request);
      return json({ Response: 'True', Awards: 'Won 7 Oscars. 370 wins & 378 nominations total' });
    });

    await expect(client.lookupAwards('tt15398776')).resolves.toEqual({
      text: 'Won 7 Oscars. 370 wins & 378 nominations total',
      url: 'https://www.imdb.com/title/tt15398776/awards/',
    });
    const url = new URL(requests[0]!.url);
    expect(url.origin + url.pathname).toBe('https://www.omdbapi.com/');
    expect(url.searchParams.get('i')).toBe('tt15398776');
    expect(url.searchParams.get('apikey')).toBe('omdb-secret');
  });

  it('returns null for absent awards and rejects invalid IMDb IDs without a request', async () => {
    const fetcher = vi.fn(async () => json({ Response: 'True', Awards: 'N/A' }));
    const client = new OmdbClient('omdb-secret', fetcher);

    await expect(client.lookupAwards('tt0078748')).resolves.toBeNull();
    await expect(client.lookupAwards('https://www.imdb.com/find/?q=Alien')).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('redacts the API key from network and HTTP errors', async () => {
    const network = new OmdbClient('omdb-secret', async () => {
      throw new Error('failed omdb-secret');
    });
    await expect(network.lookupAwards('tt0078748')).rejects.toThrow('failed [redacted]');

    const http = new OmdbClient('omdb-secret', async () => json({ Error: 'invalid omdb-secret' }, 401));
    await expect(http.lookupAwards('tt0078748')).rejects.toThrow('invalid [redacted]');
  });

  it('rejects malformed JSON without inventing awards', async () => {
    const client = new OmdbClient('omdb-secret', async () => new Response('not json'));
    await expect(client.lookupAwards('tt0078748')).rejects.toThrow('JSON non valido');
  });
});
