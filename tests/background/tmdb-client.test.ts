import { describe, expect, it } from 'vitest';
import { TmdbClient } from '../../src/background/tmdb-client';

describe('TmdbClient', () => {
  it('uses bearer authentication without putting the token in the URL', async () => {
    let captured: Request | undefined;
    const client = new TmdbClient('read-access-token', async (request) => {
      captured = request;
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });
    await client.request('/search/movie', { query: 'Film', language: 'it-IT' });
    expect(captured?.headers.get('authorization')).toBe('Bearer read-access-token');
    expect(captured?.url).not.toContain('read-access-token');
  });

  it('supports a v3 API key and redacts it from network errors', async () => {
    const apiKey = '0123456789abcdef0123456789abcdef';
    const client = new TmdbClient(apiKey, async () => { throw new Error(`failed ${apiKey}`); });
    await expect(client.request('/search/movie', { query: 'Film' }))
      .rejects.toThrow('failed [redacted]');
  });
});

