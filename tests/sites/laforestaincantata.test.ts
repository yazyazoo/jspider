// @vitest-environment jsdom
/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { laForestaAdapter } from '../../src/sites/laforestaincantata/article';
import { resolveLfiCrypt } from '../../src/sites/laforestaincantata/lficrypt';
import { laForestaModule } from '../../src/sites/laforestaincantata/module';
import allCodingsFixture from '../fixtures/sites/laforestaincantata/all-codings.html?raw';

const rootUrl = 'https://laforestaincantata.org/index.php?newsid=503997';

function versionCard(label: string, password: string, collector: string, report: string): string {
  return `<article data-film-version-card>
    <div class="film-version-card-read__badge">${label}</div>
    ${password ? `<b>Password:</b> ${password}<br>` : ''}
    <a href="${collector}">Link</a>
    <div data-report-panel><div class="film-version-report__text">${report.replaceAll('\n', '<br>')}</div></div>
  </article>`;
}

const avinaptic = `[ Info sul file ]
Dimensione: 9,873,040,735 bytes
[ Info generiche ]
Durata: 01:30:59 (5459.38 s)
[ Traccia video ]
Codec ID: V_MPEG4/ISO/AVC
Risoluzione: 1792 x 802
Dimensione stream: 8,123,956,183 bytes
Bitrate (bs): 11904.867977 kbps
Framerate: 24 fps`;

beforeEach(() => {
  document.documentElement.innerHTML = allCodingsFixture;
});

describe('La Foresta adapter', () => {
  it('exposes the article adapter through its site module', () => {
    expect(laForestaModule.definition.siteId).toBe('laforestaincantata');
    expect(laForestaModule.article).toBe(laForestaAdapter);
    expect(laForestaModule.search).toBeUndefined();
  });

  it('matches only exact article identities and canonicalizes HTTP links', () => {
    expect(laForestaAdapter.matches(rootUrl)).toBe(true);
    expect(laForestaAdapter.normalizeUrl('http://laforestaincantata.org/index.php?newsid=503997&utm=x#comments'))
      .toBe(rootUrl);
    expect(laForestaAdapter.matches('https://laforestaincantata.org/index.php?newsid=1&newsid=2')).toBe(false);
    expect(laForestaAdapter.matches('https://laforestaincantata.org.evil.test/index.php?newsid=1')).toBe(false);
  });

  it('reads independent cards, passwords, provenance, AVInaptic and unsupported Filecrypt', () => {
    const snapshot = laForestaAdapter.readPage(document, rootUrl);
    expect(snapshot).toMatchObject({
      siteId: 'laforestaincantata', title: 'Bone Keeper - Discesa negli inferi',
      year: '2026', mediaKind: 'movie', supportsThanks: true,
      thanksMode: 'validate-selection',
    });
    expect(snapshot.variants).toHaveLength(2);
    expect(snapshot.variants[0]).toMatchObject({
      articleUrl: rootUrl, articleId: '503997', password: 'FIRST',
      collectors: ['https://lficrypt.org/C538F022EC.html'],
      technical: {
        resolution: 1080, codec: 'H264', totalBytes: 9_873_040_735,
        videoBytes: 8_123_956_183, duration: 5459.38, width: 1792, height: 802,
      },
    });
    expect(snapshot.variants[1]).toMatchObject({ password: '', unsupportedCollectors: ['https://filecrypt.cc/Container/ABC.html'] });
  });

  it('aggregates only a matching linked article and retains its password and source URL', async () => {
    document.getElementById('lfi-similar-section')!.innerHTML = '<a href="?newsid=504000">Altra versione</a>';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('lficrypt_links.php')) return {
        ok: true, status: 200, text: async () => JSON.stringify({ ok: true, links: ['https://terabytez.org/a/film.rar'] }),
      };
      return {
        ok: true, status: 200, text: async () => `<meta property="og:title" content="Bone Keeper - Discesa negli inferi (2026) WebDL 4K"><div id="full-story"><b>Password:</b> SECOND<br><textarea>https://terabytez.org/b/film.rar</textarea></div>`,
      };
    }));

    const snapshot = await laForestaAdapter.loadPage?.(document, rootUrl);
    expect(snapshot?.variants).toHaveLength(3);
    expect(snapshot?.variants[2]).toMatchObject({
      articleUrl: 'https://laforestaincantata.org/index.php?newsid=504000',
      password: 'SECOND', links: ['https://terabytez.org/b/film.rar'],
    });
    vi.unstubAllGlobals();
  });

  it('thanks one locked article and maps its placeholder to every revealed version', async () => {
    const title = 'Bone Keeper - Discesa negli inferi (2026) WebDL Tutte Le Codifiche Disponibili';
    const lockedDocument = new DOMParser().parseFromString(
      `<meta property="og:title" content="${title}"><div id="full-story"><div id="thx"><a onclick="tanksForNews(503997)">Ringrazia</a></div></div>`,
      'text/html',
    );
    const unlocked = `<meta property="og:title" content="${title}"><div id="full-story">
      ${versionCard('WebDL 1080p', 'FIRST', 'https://terabytez.org/a/film.rar', avinaptic)}
      ${versionCard('WebDL 720p', 'SECOND', 'https://terabytez.org/b/film.rar', 'General\nVideo\nFormat : AVC\nWidth : 1280 pixels')}
    </div>`;
    let posted = false;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') { posted = true; return { ok: true, status: 200, text: async () => 'ok' }; }
      return { ok: true, status: 200, text: async () => posted ? unlocked : lockedDocument.documentElement.outerHTML };
    }));
    const oldKey = laForestaAdapter.readPage(lockedDocument, rootUrl).variants[0]!.key;
    expect(laForestaAdapter.readPage(lockedDocument, rootUrl).thanksMode).toBe('unlock-container');

    const result = await laForestaAdapter.thankSelected?.(lockedDocument, rootUrl, [oldKey]);
    expect(result?.thanks.thanked).toEqual([oldKey]);
    expect(result?.thanks.failed).toEqual([]);
    expect(result?.thanks.replacements?.[oldKey]).toHaveLength(2);
    expect(result?.context.variants.map((variant) => variant.password)).toEqual(['FIRST', 'SECOND']);
    expect(result?.context.thanksMode).toBe('validate-selection');
    vi.unstubAllGlobals();
  });

  it('keeps the normal selection thanks flow for a locked single-version article', () => {
    const singleDocument = new DOMParser().parseFromString(
      '<meta property="og:title" content="Bone Keeper - Discesa negli inferi (2026) WebDL 1080p"><div id="full-story"><div id="thx"><a onclick="tanksForNews(503997)">Ringrazia</a></div></div>',
      'text/html',
    );

    const snapshot = laForestaAdapter.readPage(singleDocument, rootUrl);

    expect(snapshot.thanksMode).toBe('selection');
    expect(snapshot.variants).toHaveLength(1);
    expect(snapshot.variants[0]?.locked).toBe(true);
  });

  it('treats a normal article as already unlocked when direct links exist beside the thanks widget', async () => {
    const unlockedDocument = new DOMParser().parseFromString(
      `<meta property="og:title" content="The Traitors Italy - Stagione 1 (2025) WEB-DL 1080p">
       <div id="full-story">
         <div id="thx"><a onclick="tanksForNews(471729)">Ringrazia</a></div>
         <div id="copialinkattivi" hidden>
           <textarea>https://filestore.me/example-episode.rar</textarea>
         </div>
       </div>`,
      'text/html',
    );

    const snapshot = laForestaAdapter.readPage(unlockedDocument, 'https://laforestaincantata.org/index.php?newsid=471729');

    expect(snapshot.thanksMode).toBe('selection');
    expect(snapshot.variants).toHaveLength(1);
    expect(snapshot.variants[0]?.locked).toBeFalsy();
    expect(snapshot.variants[0]?.linksLoaded).toBe(true);
    expect(snapshot.variants[0]?.links).toEqual(['https://filestore.me/example-episode.rar']);

    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      status: 200,
      text: async () => unlockedDocument.documentElement.outerHTML,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await laForestaAdapter.thankSelected?.(
      unlockedDocument,
      'https://laforestaincantata.org/index.php?newsid=471729',
      [snapshot.variants[0]!.key],
    );

    expect(result?.thanks).toMatchObject({ thanked: [], already: [snapshot.variants[0]!.key], failed: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.method).not.toBe('POST');
    vi.unstubAllGlobals();
  });
});

describe('resolveLfiCrypt', () => {
  it('accepts only the collector shape and returns unique direct archive hosts', async () => {
    const links = await resolveLfiCrypt('https://www.lficrypt.org/C538F022EC.html', async () => ({
      ok: true,
      links: [
        'https://terabytez.org/a/film.rar', 'https://terabytez.org/a/film.rar',
        'https://filestore.me/2e34fudfmqcr', 'https://evil.test/a.rar',
      ],
    }));
    expect(links).toEqual([
      'https://terabytez.org/a/film.rar', 'https://filestore.me/2e34fudfmqcr',
    ]);
  });
});

