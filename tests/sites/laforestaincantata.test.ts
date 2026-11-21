// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLfiCrypt } from '../../src/sites/lficrypt';
import { laForestaAdapter } from '../../src/sites/laforestaincantata';

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
  document.head.innerHTML = '<meta property="og:title" content="Bone Keeper - Discesa negli inferi (2026) WebDL Tutte Le Codifiche Disponibili">';
  document.body.innerHTML = `<div id="full-story">
    ${versionCard('WebDL 1080p AVC', 'FIRST', 'https://lficrypt.org/C538F022EC.html', avinaptic)}
    ${versionCard('WebDL 720p HEVC', '', 'https://filecrypt.cc/Container/ABC.html', 'General\nVideo\nFormat : HEVC\nWidth : 1280 pixels')}
  </div><div id="lfi-similar-section"></div>`;
});

describe('La Foresta adapter', () => {
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

    const result = await laForestaAdapter.thankSelected?.(lockedDocument, rootUrl, [oldKey]);
    expect(result?.thanks.thanked).toEqual([oldKey]);
    expect(result?.thanks.failed).toEqual([]);
    expect(result?.thanks.replacements?.[oldKey]).toHaveLength(2);
    expect(result?.context.variants.map((variant) => variant.password)).toEqual(['FIRST', 'SECOND']);
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

