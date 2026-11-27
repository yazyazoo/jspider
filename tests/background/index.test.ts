import { beforeEach, describe, expect, it, vi } from 'vitest';

type MessageListener = (
  message: Record<string, unknown>,
  sender: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
) => boolean | undefined;

describe('background Quick Workflow log actions', () => {
  let listener: MessageListener | undefined;
  let values: Record<string, unknown>;
  let failLogSet: boolean;
  let logDirectoryHandle: unknown;

  beforeEach(async () => {
    vi.resetModules();
    values = {};
    failLogSet = false;
    logDirectoryHandle = null;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    vi.stubGlobal('chrome', {
      action: { onClicked: { addListener: vi.fn() } },
      tabs: { sendMessage: vi.fn() },
      runtime: {
        getURL: (path: string) => `chrome-extension://jspider/${path}`,
        onMessage: { addListener: (candidate: MessageListener) => { listener = candidate; } },
      },
      storage: {
        local: {
          async get(key: string) { return { [key]: values[key] }; },
          async set(items: Record<string, unknown>) {
            if (failLogSet && Object.hasOwn(items, 'jspider.quickWorkflowLog')) {
              throw new Error('storage unavailable');
            }
            Object.assign(values, items);
          },
          async remove(key: string) { delete values[key]; },
        },
      },
    });
    const { LogDirectoryRepository } = await import('../../src/background/log-directory');
    vi.spyOn(LogDirectoryRepository.prototype, 'load')
      .mockImplementation(async () => logDirectoryHandle as never);
    await import('../../src/background/index');
  });

  async function send(action: string, data: Record<string, unknown> = {}): Promise<unknown> {
    if (action === 'taskflow.quickWorkflow' || action === 'taskflow.loadPackages') {
      const { handle, serializeError } = await import('../../src/background/application');
      try { return { ok: true, data: await handle({ target: 'background', action, ...data }, {}) }; }
      catch (reason) { return { ok: false, error: serializeError(reason) }; }
    }
    return new Promise((resolve) => {
      expect(listener?.({ target: 'background', action, ...data }, {}, resolve)).toBe(true);
    });
  }

  it('serves and clears the local log without requiring TaskFlow settings', async () => {
    await expect(send('taskflow.quickWorkflowLog.get'))
      .resolves.toEqual({ ok: true, data: null });
    await expect(send('taskflow.quickWorkflowLog.clear'))
      .resolves.toEqual({ ok: true, data: { cleared: true } });
  });

  it('rejects long operations on the service worker message channel', () => {
    const reply = vi.fn();
    expect(listener?.({ target: 'background', action: 'taskflow.quickWorkflow' }, {}, reply)).toBe(false);
    expect(reply).toHaveBeenCalledWith({ ok: false, error: expect.objectContaining({
      message: expect.stringContaining('scheda di esecuzione'),
    }) });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('continues Quick Workflow when local diagnostic storage is unavailable', async () => {
    values['jspider.settings'] = {
      taskflowBaseUrl: 'https://taskflow.example', taskflowToken: 'token',
      tmdbCredential: '', omdbApiKey: '', mdblistApiKey: '',
    };
    failLogSet = true;
    configureSuccessfulTaskFlow();

    await expect(send('taskflow.quickWorkflow', {
      variants: [{ key: '4k', packageName: 'Film', password: '', links: ['https://terabytez.org/a/film.rar'] }],
      hosts: ['terabytez.org'], autodownload: true,
      workflow: {
        workflowName: 'Film', preset: 'movie-standard',
        metadata: { mode: 'validated', id: 42, mediaKind: 'movie' },
        password: '', cleanupOnSuccess: true,
      },
    })).resolves.toMatchObject({
      ok: true,
      data: { createdWorkflow: { id: '7654321' }, startedWorkflow: { status: 'waiting_packages' } },
    });
  });

  it('names the persisted log after the Quick Workflow', async () => {
    values['jspider.settings'] = {
      taskflowBaseUrl: 'https://taskflow.example', taskflowToken: 'token',
      tmdbCredential: '', omdbApiKey: '', mdblistApiKey: '',
    };
    configureSuccessfulTaskFlow();

    await send('taskflow.quickWorkflow', {
      variants: [{ key: '4k', packageName: 'Film', password: '', links: ['https://terabytez.org/a/film.rar'] }],
      hosts: ['terabytez.org'], autodownload: true,
      workflow: {
        workflowName: 'Film', preset: 'movie-standard',
        metadata: { mode: 'validated', id: 42, mediaKind: 'movie' },
        password: '', cleanupOnSuccess: true,
      },
    });

    expect(values['jspider.quickWorkflowLog']).toMatchObject({
      workflowName: 'Film', fileName: expect.stringMatching(/^\d{4}-\d{2}-\d{2}_.*_Film\.json$/),
    });
  });

  it('prepares Follow variants from only successfully started indexed history', async () => {
    const matching = '2026-11-16_10-00-00-000_follow_tmdb-tv-12345_host-terabytez_MasterChef_S10.json';
    const unrelated = '2026-11-15_10-00-00-000_follow_tmdb-tv-999_host-terabytez_Other_S01.json';
    const files: Record<string, string> = {
      [matching]: JSON.stringify({
        runId: 'old', workflowName: 'MasterChef', fileName: matching,
        startedAt: '2026-11-16T09:00:00.000Z', updatedAt: '2026-11-16T09:01:00.000Z',
        entries: [
          { phase: 'submission', kind: 'request', payload: { packages: [{
            name: 'S10', links: ['https://terabytez.org/aaaaaaaaaaaa'],
          }] } },
          { phase: 'start', kind: 'response', payload: { id: 'workflow-old' } },
        ],
      }),
      [unrelated]: '{ broken but unrelated',
    };
    const opened: string[] = [];
    logDirectoryHandle = {
      name: 'log', async queryPermission() { return 'granted' as PermissionState; },
      async *entries() {
        for (const name of Object.keys(files)) yield [name, { kind: 'file', name }];
      },
      async getFileHandle(name: string) {
        opened.push(name);
        return { async getFile() { return { async text() { return files[name]; } }; } };
      },
    };

    await expect(send('taskflow.followSeason.prepare', {
      follow: {
        mediaKind: 'tv', tmdbId: 12345, season: 10,
        hosts: ['terabytez.org'], title: 'MasterChef',
      },
      variants: [{
        key: 's10', packageName: 'MasterChef S10', password: '', season: 10,
        links: [
          'https://terabytez.org/aaaaaaaaaaaa',
          'https://terabytez.org/bbbbbbbbbbbb',
        ],
      }],
    })).resolves.toMatchObject({
      ok: true,
      data: {
        matchedFiles: 1, currentCount: 2, processedCount: 1, newCount: 1,
        historicalHosts: ['terabytez.org'],
        variants: [{ links: ['https://terabytez.org/bbbbbbbbbbbb'] }],
      },
    });
    expect(opened).toEqual([matching]);
  });

  it('rejects Follow preparation when variants do not belong to its single season', async () => {
    await expect(send('taskflow.followSeason.prepare', {
      follow: {
        mediaKind: 'tv', tmdbId: 12345, season: 10,
        hosts: ['terabytez.org'], title: 'MasterChef',
      },
      variants: [{ key: 's09', packageName: 'S09', password: '', season: 9, links: [] }],
    })).resolves.toMatchObject({
      ok: false, error: { message: 'Le versioni Segui devono appartenere a una sola stagione.' },
    });
  });

  it('uses a Follow filename for a validated TV Quick Workflow and keeps normal logs unchanged', async () => {
    values['jspider.settings'] = {
      taskflowBaseUrl: 'https://taskflow.example', taskflowToken: 'token',
      tmdbCredential: '', omdbApiKey: '', mdblistApiKey: '',
    };
    configureSuccessfulTaskFlow();

    await send('taskflow.quickWorkflow', {
      variants: [{
        key: 's10', packageName: 'Film', password: '', season: 10,
        links: ['https://terabytez.org/a/film.rar'],
      }],
      hosts: ['terabytez.org'], autodownload: true,
      follow: {
        mediaKind: 'tv', tmdbId: 12345, season: 10,
        hosts: ['terabytez.org'], title: 'MasterChef',
      },
      workflow: {
        workflowName: 'MasterChef_S10', preset: 'tv-standard',
        metadata: { mode: 'validated', id: 12345, mediaKind: 'tv' },
        password: '', cleanupOnSuccess: true,
      },
    });

    expect(values['jspider.quickWorkflowLog']).toMatchObject({
      fileName: expect.stringMatching(/_follow_tmdb-tv-12345_host-terabytez_MasterChef_S10\.json$/),
    });
  });

  it('rejects extra Quick Workflow hosts not present in the Follow chain', async () => {
    await expect(send('taskflow.quickWorkflow', {
      variants: [{
        key: 's10', packageName: 'Film', password: '', season: 10,
        links: ['https://terabytez.org/a/film.rar'],
      }],
      hosts: ['terabytez.org', 'unknown.example'], autodownload: true,
      follow: {
        mediaKind: 'tv', tmdbId: 12345, season: 10,
        hosts: ['terabytez.org'], title: 'MasterChef',
      },
      workflow: {
        workflowName: 'MasterChef_S10', preset: 'tv-standard',
        metadata: { mode: 'validated', id: 12345, mediaKind: 'tv' },
        password: '', cleanupOnSuccess: true,
      },
    })).resolves.toMatchObject({
      ok: false, error: { message: 'Gli host Segui non corrispondono agli host Quick Workflow.' },
    });
  });

  it('loads episode one for a selected Emby season', async () => {
    vi.mocked(fetch).mockImplementation(async (request) => {
      const url = request instanceof Request ? request.url : request.toString();
      if (url === 'chrome-extension://jspider/config.local.json') {
        return json({ embyBaseUrl: 'https://emby.example', embyToken: 'emby-token' });
      }
      if (url.includes('/emby/Shows/series-1/Episodes')) {
        return json({
          Items: [{
            Id: 'episode-1', Name: 'Episode 1', Type: 'Episode', IndexNumber: 1,
            Path: '/series/Show/Season 02/Show.S02E01.1080p.mkv',
          }],
          TotalRecordCount: 1,
        });
      }
      return json({}, 404);
    });

    await expect(send('emby.season', { seriesId: 'series-1', seasonId: 'season-2' }))
      .resolves.toEqual({
        ok: true,
        data: { seasonId: 'season-2', files: ['Show.S02E01.1080p'] },
      });
  });

  it('rejects empty Emby season identifiers', async () => {
    vi.mocked(fetch).mockImplementation(async (request) => {
      const url = request instanceof Request ? request.url : request.toString();
      return url === 'chrome-extension://jspider/config.local.json'
        ? json({ embyBaseUrl: 'https://emby.example', embyToken: 'emby-token' })
        : json({}, 404);
    });

    await expect(send('emby.season', { seriesId: '', seasonId: 'season-2' }))
      .resolves.toMatchObject({
        ok: false,
        error: { message: 'Identificatore Emby non valido.' },
      });
  });

  it('serves a keyless JustWatch lookup without loading saved settings', async () => {
    vi.mocked(fetch).mockImplementation(async (request) => {
      const url = request instanceof Request ? request.url : request.toString();
      if (url === 'https://apis.justwatch.com/graphql') {
        return json({ data: { popularTitles: { edges: [{ node: {
          id: 'tm72398', objectType: 'MOVIE', content: {
            title: 'Alien', originalReleaseYear: 1979, fullPath: '/it/film/alien',
            externalIds: { imdbId: 'tt0078748' }, scoring: { jwRating: 0.970576782193 },
          },
        } }] } } });
      }
      return json({}, 404);
    });

    await expect(send('justwatch.lookup', { input: {
      tmdbId: 348, mediaKind: 'movie', title: 'Alien', year: '1979', imdbId: 'tt0078748',
    } })).resolves.toMatchObject({
      ok: true,
      data: { source: 'justwatch', value: '97%', url: 'https://www.justwatch.com/it/film/alien' },
    });
  });

  it('serves OMDb awards using the configured key', async () => {
    values['jspider.settings'] = {
      taskflowBaseUrl: 'https://taskflow.example', taskflowToken: '',
      tmdbCredential: '', omdbApiKey: 'omdb-secret', mdblistApiKey: '',
    };
    vi.mocked(fetch).mockImplementation(async (request) => {
      const url = new URL(request instanceof Request ? request.url : request.toString());
      if (url.protocol === 'chrome-extension:') return json({});
      if (url.origin === 'https://www.omdbapi.com') {
        expect(url.searchParams.get('apikey')).toBe('omdb-secret');
        expect(url.searchParams.get('i')).toBe('tt15398776');
        return json({ Response: 'True', Awards: 'Won 7 Oscars' });
      }
      return json({}, 404);
    });

    await expect(send('omdb.awards', { imdbId: 'tt15398776' })).resolves.toEqual({
      ok: true,
      data: { text: 'Won 7 Oscars', url: 'https://www.imdb.com/title/tt15398776/awards/' },
    });
  });
});

function configureSuccessfulTaskFlow(): void {
  vi.mocked(fetch).mockImplementation(async (request) => {
    const url = request instanceof Request ? request.url : request.toString();
    if (url.endsWith('/api/v1/integrations')) {
      return json([{ id: '2510505', type: 'jdownloader', enabled: true }]);
    }
    if (url.endsWith('/submission')) {
      return json([{ name: 'Film', jd_id: 'jd', taskflow_id: '1234567' }]);
    }
    if (url.endsWith('/start')) return json({ id: '7654321', status: 'waiting_packages' });
    if (url.endsWith('/api/v1/workflows')) return json({ id: '7654321', status: 'created' }, 201);
    return json({}, 404);
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
}
