import { describe, expect, it, vi } from 'vitest';
import { EmbyClient } from '../../src/background/emby-client';

describe('EmbyClient', () => {
  it('queries by TMDB with the API token only in the header', async () => {
    let captured: Request | undefined;
    const client = new EmbyClient('http://emby.example:8096', 'emby-secret', async (request) => {
      captured = request;
      return new Response(JSON.stringify({ Items: [], TotalRecordCount: 0 }));
    });

    await client.lookup({ mode: 'tmdb', tmdbId: 42, mediaKind: 'movie' });

    expect(captured?.headers.get('X-Emby-Token')).toBe('emby-secret');
    expect(captured?.url).not.toContain('emby-secret');
    expect(captured?.url).toContain('/emby/Items?');
    expect(captured?.url).toContain('IncludeItemTypes=Movie');
    expect(captured?.url).toContain('AnyProviderIdEquals=tmdb.42');
    expect(captured?.url).toContain('Fields=ProviderIds%2CPath');
  });

  it('queries title/year fallback with a coherent item type', async () => {
    let captured: Request | undefined;
    const client = new EmbyClient('https://emby.example/emby', 'token', async (request) => {
      captured = request;
      return new Response(JSON.stringify({ Items: [], TotalRecordCount: 0 }));
    });

    await client.lookup({ mode: 'title', title: 'Colony', year: 2026, mediaKind: 'tv' });

    expect(captured?.url).toContain('/emby/Items?');
    expect(captured?.url).not.toContain('/emby/emby/');
    expect(captured?.url).toContain('SearchTerm=Colony');
    expect(captured?.url).toContain('Years=2026');
    expect(captured?.url).toContain('IncludeItemTypes=Series');
  });

  it.each([401, 403])('reports authorization failure for HTTP %s', async (status) => {
    const client = new EmbyClient('https://emby.example', 'token', async () =>
      new Response('', { status }));
    await expect(client.lookup({ mode: 'tmdb', tmdbId: 42, mediaKind: 'movie' }))
      .rejects.toThrow('Token Emby non valido o non autorizzato.');
  });

  it('does not turn a timeout into an absent result', async () => {
    vi.useFakeTimers();
    const client = new EmbyClient('https://emby.example', 'token',
      (request) => new Promise((_resolve, reject) => {
        request.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }), 25);
    const result = client.lookup({ mode: 'tmdb', tmdbId: 42, mediaKind: 'movie' });
    const rejection = expect(result).rejects
      .toThrow('Emby non raggiungibile entro il tempo previsto.');
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    vi.useRealTimers();
  });

  it('rejects a malformed response', async () => {
    const client = new EmbyClient('https://emby.example', 'token', async () =>
      new Response(JSON.stringify({ unexpected: true })));
    await expect(client.lookup({ mode: 'tmdb', tmdbId: 42, mediaKind: 'movie' }))
      .rejects.toThrow('Risposta Emby non valida.');
  });
});
