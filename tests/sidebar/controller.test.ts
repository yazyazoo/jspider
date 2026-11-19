// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { PageSnapshot } from '../../src/domain/models';
import { searchTmdb } from '../../src/domain/tmdb';
import {
  autoSearchSnapshot,
  applyCreateModeView,
  clearTmdbView,
  initializeOverlayWidthControl,
  LatestResultGate,
  loadCandidateEnrichments,
  runSidebarStartup,
} from '../../src/sidebar/controller';
import { initialCreateModeState, lockCreateMode, selectCreateMode } from '../../src/domain/create-mode';

const snapshot: PageSnapshot = {
  siteId: 'titanhd',
  siteName: 'TitanHD',
  sourceUrl: 'https://titanhd.space/catalogo/14481',
  title: "L'isola dei ricordi",
  year: '2026',
  imdbId: 'tt36583977',
  mediaKind: 'movie',
  supportsThanks: true,
  variants: [],
};

describe('automatic snapshot TMDB lookup', () => {
  it('uses IMDb immediately and returns a poster candidate without validating it', async () => {
    const result = await autoSearchSnapshot(snapshot, true, (input) => searchTmdb(
      input,
      async (path) => {
        expect(path).toBe('/find/tt36583977');
        return { movie_results: [{
          id: 1465063,
          title: 'Forgotten Island',
          release_date: '2026-09-10',
          overview: 'Trama',
          poster_path: '/poster.jpg',
        }] };
      },
    ));

    expect(result).toEqual({ method: 'imdb', candidates: [{
      id: 1465063,
      mediaKind: 'movie',
      title: 'Forgotten Island',
      year: '2026',
      overview: 'Trama',
      poster: 'https://image.tmdb.org/t/p/w185/poster.jpg',
      voteAverage: null,
      voteCount: 0,
      url: 'https://www.themoviedb.org/movie/1465063',
      imdbUrl: 'https://www.imdb.com/title/tt36583977/',
    }] });
    expect(result).not.toHaveProperty('validated');
  });

  it('does nothing when TMDB is not configured', async () => {
    const result = await autoSearchSnapshot(snapshot, false, async () => {
      throw new Error('non deve essere chiamata');
    });
    expect(result).toBeNull();
  });
});

describe('exclusive phase 3 mode', () => {
  it('shows Quick Workflow by default and never exposes both branches', () => {
    const quickPanel = document.createElement('div');
    const taskflowPanel = document.createElement('div');
    const quickChoice = document.createElement('input');
    const taskflowChoice = document.createElement('input');
    applyCreateModeView(initialCreateModeState(), {
      quickPanel, taskflowPanel, quickChoice, taskflowChoice,
    });
    expect({
      quickHidden: quickPanel.hidden,
      taskflowHidden: taskflowPanel.hidden,
      quickChecked: quickChoice.checked,
      taskflowChecked: taskflowChoice.checked,
    }).toEqual({ quickHidden: false, taskflowHidden: true, quickChecked: true, taskflowChecked: false });
  });

  it('shows only TaskFlow and disables both choices after package submission locks the batch', () => {
    const quickPanel = document.createElement('div');
    const taskflowPanel = document.createElement('div');
    const quickChoice = document.createElement('input');
    const taskflowChoice = document.createElement('input');
    const state = lockCreateMode(selectCreateMode(initialCreateModeState(), 'taskflow'));
    applyCreateModeView(state, { quickPanel, taskflowPanel, quickChoice, taskflowChoice });
    expect({
      quickHidden: quickPanel.hidden,
      taskflowHidden: taskflowPanel.hidden,
      quickDisabled: quickChoice.disabled,
      taskflowDisabled: taskflowChoice.disabled,
    }).toEqual({ quickHidden: true, taskflowHidden: false, quickDisabled: true, taskflowDisabled: true });
  });
});

describe('TMDB request ordering', () => {
  it('ignores an older result that completes after a newer request', async () => {
    const gate = new LatestResultGate();
    let finishFirst!: (value: string) => void;
    const firstValue = new Promise<string>((resolve) => { finishFirst = resolve; });
    const first = gate.run(() => firstValue);
    const second = gate.run(async () => 'second');

    await expect(second).resolves.toBe('second');
    finishFirst('first');
    await expect(first).resolves.toBeNull();
  });

  it('ignores an older failure after a newer request succeeds', async () => {
    const gate = new LatestResultGate();
    let failFirst!: (reason: Error) => void;
    const firstValue = new Promise<string>((_resolve, reject) => { failFirst = reject; });
    const first = gate.run(() => firstValue);
    await expect(gate.run(async () => 'second')).resolves.toBe('second');

    failFirst(new Error('errore vecchio'));
    await expect(first).resolves.toBeNull();
  });
});

describe('candidate rating enrichment', () => {
  it('loads each candidate independently and omits failed lookups', async () => {
    const candidates = [
      { id: 1, mediaKind: 'movie' as const, title: 'Film', year: '2026' },
      { id: 2, mediaKind: 'tv' as const, title: 'Serie', year: '2025' },
    ];
    const result = await loadCandidateEnrichments(candidates, true, async (input) => {
      if (input.tmdbId === 2) throw new Error('unavailable');
      expect(input).toEqual({ tmdbId: 1, mediaKind: 'movie', title: 'Film', year: '2026' });
      return {
        ratings: [],
        awards: { text: 'Won', url: 'https://www.imdb.com/title/tt1/awards/' },
        imdbId: 'tt1',
      };
    });

    expect([...result.keys()]).toEqual([1, 2]);
    expect(result.get(1)?.awards?.text).toBe('Won');
    expect(result.get(2)?.ratings.find((rating) => rating.source === 'trakt')?.url)
      .toBe('https://trakt.tv/search/tmdb/2?id_type=show');
  });

  it('keeps fallback provider links without calling MDBList when it is not configured', async () => {
    let called = false;
    const result = await loadCandidateEnrichments(
      [{ id: 1, mediaKind: 'movie', title: 'Alien', year: '1979' }],
      false,
      async () => { called = true; throw new Error(); },
    );
    expect(called).toBe(false);
    expect(result.get(1)?.ratings.find((rating) => rating.source === 'imdb')?.url)
      .toBe('https://www.imdb.com/find/?q=Alien+1979&s=tt');
  });

  it('overlays an exact JustWatch result and keeps the fallback when JustWatch fails', async () => {
    const candidates = [
      { id: 348, mediaKind: 'movie' as const, title: 'Alien', year: '1979' },
      { id: 288120, mediaKind: 'tv' as const, title: 'Vienna Game', year: '2026' },
    ];
    const result = await loadCandidateEnrichments(
      candidates,
      true,
      async (input) => ({
        ratings: [], awards: null, imdbId: input.tmdbId === 348 ? 'tt0078748' : 'tt31844371',
      }),
      async (input) => {
        if (input.tmdbId === 288120) throw new Error('endpoint cambiato');
        expect(input.imdbId).toBe('tt0078748');
        return {
          source: 'justwatch', label: 'JustWatch', value: '97%', votes: null,
          url: 'https://www.justwatch.com/it/film/alien',
        };
      },
    );

    expect(result.get(348)?.ratings.find((rating) => rating.source === 'justwatch'))
      .toMatchObject({ value: '97%', url: 'https://www.justwatch.com/it/film/alien' });
    expect(result.get(288120)?.ratings.find((rating) => rating.source === 'justwatch'))
      .toMatchObject({ value: null, url: 'https://www.justwatch.com/it/cerca?q=Vienna+Game+2026' });
  });

  it('keeps MDBList awards and asks OMDb only for awards that are missing', async () => {
    const omdbIds: string[] = [];
    const result = await loadCandidateEnrichments(
      [
        { id: 1, mediaKind: 'movie', title: 'First', year: '2025', imdbUrl: 'https://www.imdb.com/title/tt1111111/' },
        { id: 2, mediaKind: 'tv', title: 'Second', year: '2024', imdbUrl: 'https://www.imdb.com/title/tt2222222/' },
      ],
      true,
      async (input) => ({
        ratings: [],
        awards: input.tmdbId === 1
          ? { text: 'MDBList awards', url: 'https://www.imdb.com/title/tt1111111/awards/' }
          : null,
        imdbId: input.tmdbId === 1 ? 'tt1111111' : 'tt2222222',
      }),
      async () => null,
      true,
      async (imdbId) => {
        omdbIds.push(imdbId);
        return { text: 'OMDb awards', url: `https://www.imdb.com/title/${imdbId}/awards/` };
      },
    );

    expect(omdbIds).toEqual(['tt2222222']);
    expect(result.get(1)?.awards?.text).toBe('MDBList awards');
    expect(result.get(2)?.awards?.text).toBe('OMDb awards');
  });

  it('falls back to the TMDB candidate IMDb ID when MDBList fails', async () => {
    const omdbIds: string[] = [];
    const result = await loadCandidateEnrichments(
      [
        { id: 1, mediaKind: 'movie', title: 'Alien', year: '1979', imdbUrl: 'https://www.imdb.com/title/tt0078748/' },
        { id: 2, mediaKind: 'movie', title: 'Unknown', year: '2026', imdbUrl: 'https://www.imdb.com/find/?q=Unknown+2026&s=tt' },
      ],
      true,
      async () => { throw new Error('MDBList unavailable'); },
      async () => null,
      true,
      async (imdbId) => {
        omdbIds.push(imdbId);
        return { text: 'Recovered awards', url: `https://www.imdb.com/title/${imdbId}/awards/` };
      },
    );

    expect(omdbIds).toEqual(['tt0078748']);
    expect(result.get(1)?.awards?.text).toBe('Recovered awards');
    expect(result.get(2)?.awards).toBeNull();
  });

  it('keeps missing awards non-blocking when OMDb fails', async () => {
    const result = await loadCandidateEnrichments(
      [{ id: 1, mediaKind: 'movie', title: 'Alien', year: '1979', imdbUrl: 'https://www.imdb.com/title/tt0078748/' }],
      false,
      async () => { throw new Error('must not run'); },
      async () => null,
      true,
      async () => { throw new Error('OMDb unavailable'); },
    );

    expect(result.get(1)?.awards).toBeNull();
  });
});

describe('TMDB validation view', () => {
  it('removes a stale validation label and candidate cards', () => {
    const results = document.createElement('div');
    results.append(document.createElement('article'));
    const validation = document.createElement('p');
    validation.textContent = 'Validato: vecchio titolo';

    clearTmdbView({ results, validation });

    expect(results.childElementCount).toBe(0);
    expect(validation.textContent).toBe('');
  });
});

describe('overlay width control', () => {
  it('shows the control only in the overlay surface and selects the current width', async () => {
    const container = document.createElement('label');
    container.hidden = true;
    const select = document.createElement('select');
    for (const width of [420, 520, 650, 780, 900]) select.append(new Option(String(width), String(width)));

    await expect(initializeOverlayWidthControl(
      'chrome-extension://jspider/sidebar.html?surface=overlay',
      { container, select },
      async () => ({ open: true, width: 780 }),
    )).resolves.toBe(true);
    expect(container.hidden).toBe(false);
    expect(select.value).toBe('780');

    container.hidden = true;
    await expect(initializeOverlayWidthControl(
      'chrome-extension://jspider/sidebar.html',
      { container, select },
      async () => { throw new Error('non deve essere chiamata'); },
    )).resolves.toBe(false);
    expect(container.hidden).toBe(true);
  });
});

describe('sidebar startup', () => {
  it('does not let a slow TaskFlow catalog block width or page loading', async () => {
    const calls: string[] = [];
    let releaseCatalog!: () => void;
    const catalog = new Promise<void>((resolve) => { releaseCatalog = resolve; });

    await runSidebarStartup({
      loadSettings: async () => { calls.push('settings'); },
      initializeOverlayWidth: async () => { calls.push('width'); },
      loadCatalog: async () => { calls.push('catalog'); await catalog; },
      readSnapshot: async () => { calls.push('snapshot'); },
    });

    expect(calls).toContain('width');
    expect(calls).toContain('snapshot');
    releaseCatalog();
  });
});
