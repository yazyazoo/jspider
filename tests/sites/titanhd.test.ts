// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { titanHdAdapter } from '../../src/sites/titanhd';

beforeEach(() => {
  document.body.innerHTML = `<h1>L'isola dei ricordi</h1>
    <script type="application/ld+json">[{"@type":"Movie","name":"L'isola dei ricordi","datePublished":"2026-09-10"}]</script>
    <a href="https://imdb.com/title/tt36583977/">IMDb</a>
    <button id="tab-a">4K WEB-DL</button>
    <div data-rel-panel="0" data-version-key="4k" aria-labelledby="tab-a">
      <pre>General\nDuration : 1 h 40 min\nVideo\nFormat : HEVC\nBit rate : 20 Mb/s</pre>
      <div data-hl data-hl-key="4k" data-hl-package="Film 2160p" data-hl-password="RAR-PASS">
        <div data-hl-links="https://filestore.me/a/film.part1.rar&#10;https://terabytez.org/b/film.part1.rar"></div>
      </div>
    </div>
    <button id="tab-b">1080p H264</button>
    <div data-rel-panel="1" data-version-key="1080" aria-labelledby="tab-b">
      <pre>General\nDuration : 1 h 40 min\nVideo\nFormat : AVC\nBit rate : 9 Mb/s</pre>
      <div data-locked="1"></div>
    </div>`;
});

describe('TitanHD adapter', () => {
  it('matches only exact HTTPS title-page URLs', () => {
    expect(titanHdAdapter.matches('https://titanhd.space/catalogo/14481')).toBe(true);
    expect(titanHdAdapter.normalizeUrl('https://titanhd.space/catalogo/14481/#links'))
      .toBe('https://titanhd.space/catalogo/14481');
    expect(titanHdAdapter.matches('https://titanhd.space.evil.test/catalogo/14481')).toBe(false);
    expect(titanHdAdapter.matches('http://titanhd.space/catalogo/14481')).toBe(false);
  });

  it('reads metadata and keeps locked versions visible without mixing passwords or links', () => {
    const snapshot = titanHdAdapter.readPage(document, 'https://titanhd.space/catalogo/14481');
    expect(snapshot).toMatchObject({
      siteId: 'titanhd', title: "L'isola dei ricordi", year: '2026',
      imdbId: 'tt36583977', mediaKind: 'movie', supportsThanks: true,
    });
    expect(snapshot.variants).toHaveLength(2);
    expect(snapshot.variants[0]).toMatchObject({
      key: '4k:0', packageName: 'Film 2160p', password: 'RAR-PASS',
      links: ['https://filestore.me/a/film.part1.rar', 'https://terabytez.org/b/film.part1.rar'],
    });
    expect(snapshot.variants[1]).toMatchObject({ key: '1080:1', password: '', links: [], locked: true });
  });

  it('loads a lazy release through its native tab and restores the active tab', async () => {
    document.querySelector('[data-version-key="1080"]')?.querySelector('[data-locked]')?.remove();
    document.getElementById('tab-a')?.setAttribute('aria-selected', 'true');
    const clicks: string[] = [];
    document.getElementById('tab-a')?.addEventListener('click', () => clicks.push('a'));
    document.getElementById('tab-b')?.addEventListener('click', () => {
      clicks.push('b');
      setTimeout(() => {
        const panel = document.querySelector('[data-version-key="1080"]');
        panel?.insertAdjacentHTML('beforeend', '<div data-hl data-hl-package="Film 1080p"><div data-hl-links="https://terabytez.org/c/film.rar"></div></div>');
      }, 0);
    });

    const snapshot = await titanHdAdapter.loadPage?.(document, 'https://titanhd.space/catalogo/14481');
    expect(snapshot?.variants[1]?.links).toEqual(['https://terabytez.org/c/film.rar']);
    expect(clicks).toEqual(['b', 'a']);
  });

  it('thanks selected locked releases through Titan and rereads the unlocked links', async () => {
    document.body.insertAdjacentHTML('afterbegin', '<div class="rel-picker" data-media-id="77"></div>');
    document.querySelector('[data-version-key="1080"]')?.insertAdjacentHTML(
      'beforeend', '<button data-thanks data-release-key="1080">Ringrazia</button>',
    );
    const lockedHtml = document.documentElement.outerHTML;
    const unlockedHtml = lockedHtml.replace(
      '<div data-locked="1"></div>',
      '<div data-hl data-hl-key="1080" data-hl-package="Film 1080p"><div data-hl-links="https://terabytez.org/c/film.rar"></div></div>',
    );
    let posted = false;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') { posted = true; return { ok: true, status: 200, url: '', text: async () => '' }; }
      return { ok: true, status: 200, url: '', text: async () => posted ? unlockedHtml : lockedHtml };
    }));
    const key = titanHdAdapter.readPage(document, 'https://titanhd.space/catalogo/14481').variants[1]!.key;

    const result = await titanHdAdapter.thankSelected?.(
      document, 'https://titanhd.space/catalogo/14481', [key],
    );
    expect(result?.thanks).toMatchObject({ thanked: [key], already: [], failed: [] });
    expect(result?.context.variants[1]?.links).toEqual(['https://terabytez.org/c/film.rar']);
    vi.unstubAllGlobals();
  });
});

