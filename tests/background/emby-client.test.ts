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

  it('loads seasons and episode one of the latest normal season for a series', async () => {
    const requests: Request[] = [];
    const client = new EmbyClient('https://emby.example', 'token', async (request) => {
      requests.push(request);
      const url = new URL(request.url);
      if (url.pathname.endsWith('/emby/Items')) {
        return new Response(JSON.stringify({
          Items: [{
            Id: 'series-1', Name: 'Show', Type: 'Series', ProductionYear: 2025,
            ProviderIds: { Tmdb: '123' }, Path: '/series/Show (2025)',
          }],
          TotalRecordCount: 1,
        }));
      }
      if (url.pathname.endsWith('/emby/Shows/series-1/Seasons')) {
        return new Response(JSON.stringify({
          Items: [
            { Id: 'season-12', Name: 'Season 12', IndexNumber: 12 },
            { Id: 'specials', Name: 'Specials', IndexNumber: 0 },
            { Id: 'season-2', Name: 'Season 2', IndexNumber: 2 },
          ],
          TotalRecordCount: 3,
        }));
      }
      expect(url.pathname).toBe('/emby/Shows/series-1/Episodes');
      expect(url.searchParams.get('SeasonId')).toBe('season-12');
      return new Response(JSON.stringify({
        Items: [
          {
            Id: 'episode-2', Name: 'Episode 2', Type: 'Episode', IndexNumber: 2,
            Path: '/series/Show/Season 12/Show.S12E02.2160p.mkv',
          },
          {
            Id: 'episode-1', Name: 'Episode 1', Type: 'Episode', IndexNumber: 1,
            Path: '/series/Show/Season 12/Show.S12E01.2160p.mkv',
            MediaSources: [
              { Path: '/series/Show/Season 12/Show.S12E01.2160p.mkv' },
              { Path: '/series/Show/Season 12/Show.S12E01.1080p.mkv' },
            ],
          },
        ],
        TotalRecordCount: 2,
      }));
    });

    await expect(client.lookup({ mode: 'tmdb', tmdbId: 123, mediaKind: 'tv' })).resolves.toEqual({
      state: 'present',
      files: ['Show.S12E01.2160p', 'Show.S12E01.1080p'],
      series: {
        seriesId: 'series-1',
        seasons: [
          { id: 'specials', number: 0, name: 'Specials' },
          { id: 'season-2', number: 2, name: 'Season 2' },
          { id: 'season-12', number: 12, name: 'Season 12' },
        ],
        selectedSeasonId: 'season-12',
      },
    });
    expect(requests).toHaveLength(3);
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(requests.every((request) => request.headers.get('X-Emby-Token') === 'token')).toBe(true);
  });

  it('loads episode one for a selected season and encodes opaque ids', async () => {
    let captured: Request | undefined;
    const client = new EmbyClient('https://emby.example', 'token', async (request) => {
      captured = request;
      return new Response(JSON.stringify({
        Items: [{
          Id: 'episode-1', Name: 'Episode 1', Type: 'Episode', IndexNumber: 1,
          Path: '/series/Show/Season 02/Show.S02E01.1080p.mkv',
        }],
        TotalRecordCount: 1,
      }));
    });

    await expect(client.lookupSeasonEpisodeOne('series/one', 'season/two')).resolves.toEqual({
      seasonId: 'season/two', files: ['Show.S02E01.1080p'],
    });
    expect(captured?.url).toContain('/Shows/series%2Fone/Episodes');
    expect(new URL(captured!.url).searchParams.get('SeasonId')).toBe('season/two');
    expect(new URL(captured!.url).searchParams.get('Fields'))
      .toBe('Path,FileName,MediaSources');
  });

  it('rejects malformed episode records instead of reporting episode one absent', async () => {
    const client = new EmbyClient('https://emby.example', 'token', async () =>
      new Response(JSON.stringify({ Items: [{}], TotalRecordCount: 1 })));

    await expect(client.lookupSeasonEpisodeOne('series-1', 'season-1'))
      .rejects.toThrow('Risposta Emby non valida.');
  });

  it('rejects an existing episode one without any usable filename', async () => {
    const client = new EmbyClient('https://emby.example', 'token', async () =>
      new Response(JSON.stringify({
        Items: [{ Id: 'episode-1', Name: 'Episode 1', Type: 'Episode', IndexNumber: 1 }],
        TotalRecordCount: 1,
      })));

    await expect(client.lookupSeasonEpisodeOne('series-1', 'season-1'))
      .rejects.toThrow('Risposta Emby non valida.');
  });

  it('marks duplicate TMDB series containers ambiguous instead of discarding one', async () => {
    let requests = 0;
    const client = new EmbyClient('https://emby.example', 'token', async () => {
      requests += 1;
      return new Response(JSON.stringify({
        Items: [
          {
            Id: 'series-a', Name: 'Show', Type: 'Series', ProductionYear: 2025,
            ProviderIds: { Tmdb: '123' }, Path: '/library-a/Show (2025) Library A',
          },
          {
            Id: 'series-b', Name: 'Show', Type: 'Series', ProductionYear: 2025,
            ProviderIds: { Tmdb: '123' }, Path: '/library-b/Show (2025) Library B',
          },
        ],
        TotalRecordCount: 2,
      }));
    });

    await expect(client.lookup({ mode: 'tmdb', tmdbId: 123, mediaKind: 'tv' })).resolves.toEqual({
      state: 'ambiguous',
      files: ['Show (2025) Library A', 'Show (2025) Library B'],
    });
    expect(requests).toBe(1);
  });

  it('does not request series details for movies', async () => {
    let requests = 0;
    const client = new EmbyClient('https://emby.example', 'token', async () => {
      requests += 1;
      return new Response(JSON.stringify({ Items: [], TotalRecordCount: 0 }));
    });

    await client.lookup({ mode: 'tmdb', tmdbId: 42, mediaKind: 'movie' });
    expect(requests).toBe(1);
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
