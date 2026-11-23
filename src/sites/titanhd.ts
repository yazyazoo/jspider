import { normalizeArchiveUrl } from '../domain/archive-links';
import type { MediaKind, PageSnapshot, ReleaseVariant } from '../domain/models';
import { parseQuantity, parseTechnicalReport } from '../domain/technical';
import type { SiteAdapter, ThanksFailure, ThanksResult } from './types';

interface TitanEntry {
  panel: Element;
  qualityTab: HTMLElement | null;
  seasonTab: HTMLElement | null;
  season: number | null;
  releaseKey: string;
  key: string;
}

function pageUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'titanhd.space' || url.port
    || url.username || url.password || !/^\/catalogo\/\d+\/?$/.test(url.pathname)) {
    throw new Error('Apri una scheda titolo TitanHD.');
  }
  return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
}

function flattenStructured(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenStructured);
  if (value === null || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return [record, ...flattenStructured(record['@graph'])];
}

function entries(document: Document): TitanEntry[] {
  const releasePanels = [...document.querySelectorAll('[data-rel-panel]')];
  const qualities = releasePanels.length ? releasePanels : [...document.querySelectorAll('[data-hl]')];
  const items: TitanEntry[] = [];
  for (const quality of qualities) {
    const seasonPanels = [...quality.querySelectorAll('[data-season-panel]')];
    for (const panel of seasonPanels.length ? seasonPanels : [quality]) {
      const node = panel.matches('[data-hl]') ? panel : panel.querySelector('[data-hl]');
      const releaseKey = panel.getAttribute('data-version-key')
        ?? node?.getAttribute('data-hl-key') ?? 'release';
      const qualityTabId = quality.getAttribute('aria-labelledby');
      const seasonTabId = panel.getAttribute('aria-labelledby');
      const qualityTab = qualityTabId ? document.getElementById(qualityTabId) : null;
      const seasonTab = panel !== quality && seasonTabId ? document.getElementById(seasonTabId) : null;
      const seasonText = seasonTab?.textContent ?? panel.querySelector('h3')?.textContent ?? '';
      const season = panel !== quality
        ? Number(releaseKey.match(/^s(\d+)(?:\||$)/i)?.[1]
          ?? seasonText.match(/Stagione\s+(\d+)/i)?.[1]) || null
        : null;
      items.push({
        panel, qualityTab, seasonTab, season, releaseKey,
        key: `${releaseKey}:${items.length}`,
      });
    }
  }
  return items;
}

function videoTile(panel: Element): Element | undefined {
  return [...panel.querySelectorAll('.vm-tile')]
    .find((item) => item.querySelector('strong')?.textContent?.trim() === 'Video');
}

const refreshedPages = new WeakMap<Document, PageSnapshot>();

function structuredMedia(document: Document): Record<string, unknown> {
  return [...document.querySelectorAll('script[type="application/ld+json"]')]
    .flatMap((script) => {
      try { return flattenStructured(JSON.parse(script.textContent ?? '')); }
      catch { return []; }
    })
    .find((item) => {
      const values = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      return values.some((value) => value === 'Movie' || value === 'TVSeries');
    }) ?? {};
}

function readDocument(document: Document, value: string): PageSnapshot {
  const sourceUrl = pageUrl(value);
  const media = structuredMedia(document);
  const types = Array.isArray(media['@type']) ? media['@type'] : [media['@type']];
  const mediaKind: MediaKind | '' = types.includes('Movie') ? 'movie' : types.includes('TVSeries') ? 'tv' : '';
  const imdbId = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].flatMap((anchor) => {
    try {
      const url = new URL(anchor.getAttribute('href') ?? '', sourceUrl);
      const match = /^(?:www\.)?imdb\.com$/.test(url.hostname) ? url.pathname.match(/^\/title\/(tt\d+)/) : null;
      return match?.[1] ? [match[1]] : [];
    } catch { return []; }
  })[0] ?? '';
  const title = typeof media.name === 'string'
    ? media.name : document.querySelector('h1')?.textContent?.trim() ?? '';
  const variants: ReleaseVariant[] = entries(document).map((entry) => {
    const { panel, qualityTab, season, key, releaseKey } = entry;
    const node = panel.matches('[data-hl]') ? panel : panel.querySelector('[data-hl]');
    let packageName = node?.getAttribute('data-hl-package')
      ?? [title, qualityTab?.textContent ?? panel.querySelector('h3')?.textContent]
        .filter(Boolean).join(' — ').replace(/\s+/g, ' ').trim();
    if (season !== null && !new RegExp(`\\b(?:S0*${season}|Stagione\\s*${season})\\b`, 'i').test(packageName)) {
      packageName += ` — Stagione ${season}`;
    }
    const summary = [...(videoTile(panel)?.querySelectorAll('span') ?? [])]
      .map((item) => item.textContent ?? '').join(' ');
    const label = `${packageName} ${qualityTab?.textContent ?? ''} ${releaseKey.replace(/\|/g, ' ')}`;
    const technical = parseTechnicalReport(
      panel.querySelector('.vm-report pre, pre')?.textContent ?? '', label, summary,
    );
    technical.totalBytes ??= parseQuantity(panel.querySelector('.vm-size')?.textContent, 'bytes');
    const links = node ? [...node.querySelectorAll('[data-hl-links]')]
      .flatMap((element) => (element.getAttribute('data-hl-links') ?? '').split(/\s+/))
      .map(normalizeArchiveUrl).filter((link): link is string => link !== null) : [];
    return {
      key, packageName, password: node?.getAttribute('data-hl-password') ?? '',
      links: [...new Set(links)], linksLoaded: node !== null, technical,
      ...(season !== null ? { season, technicalSample: true } : {}),
      ...(panel.querySelector('[data-locked="1"]') && !links.length ? { locked: true } : {}),
    };
  });
  return {
    siteId: 'titanhd', siteName: 'TitanHD', supportsThanks: true,
    sourceUrl, title, year: String(media.datePublished ?? '').slice(0, 4),
    imdbId, mediaKind, variants,
  };
}

function readPage(document: Document, value: string): PageSnapshot {
  const current = readDocument(document, value);
  const refreshed = refreshedPages.get(document);
  if (!refreshed || refreshed.sourceUrl !== current.sourceUrl) return current;
  const known = new Map(refreshed.variants.map((variant) => [variant.key, variant]));
  current.variants = current.variants.map((variant) => {
    const replacement = known.get(variant.key);
    return variant.links.length || !replacement?.links.length ? variant : replacement;
  });
  return current;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  url?: string;
  text(): Promise<string>;
}

async function thankSelected(
  document: Document,
  value: string,
  variantKeys: readonly string[],
): Promise<ThanksResult> {
  const sourceUrl = pageUrl(value);
  const knownEntries = new Map(entries(document).map((entry) => [entry.key, entry]));
  const keys = [...new Set(variantKeys)];
  if (!keys.length || keys.some((key) => !knownEntries.has(key))) {
    throw new Error('Seleziona versioni disponibili prima di ringraziare.');
  }
  const mediaId = document.querySelector('.rel-picker[data-media-id]')?.getAttribute('data-media-id');
  if (!mediaId || typeof globalThis.fetch !== 'function') {
    throw new Error('Dati per il ringraziamento non disponibili. Aggiorna la pagina.');
  }
  const request = async (url: string, options: RequestInit): Promise<FetchResponse> => {
    const response = await globalThis.fetch(url, {
      ...options, credentials: 'same-origin', redirect: 'error', cache: 'no-store',
    }) as unknown as FetchResponse;
    if (response.status === 401) throw new Error('Accedi di nuovo a TitanHD prima di ringraziare.');
    if (!response.ok) throw new Error(`TitanHD non ha confermato la richiesta (${response.status}).`);
    if (response.url && !response.url.startsWith('https://titanhd.space/')) {
      throw new Error('Risposta da un sito diverso.');
    }
    return response;
  };
  const refresh = async () => {
    const response = await request(sourceUrl, { method: 'GET' });
    if (response.url && pageUrl(response.url) !== sourceUrl) throw new Error('Pagina cambiata durante il ringraziamento.');
    const snapshotDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
    if (snapshotDocument.querySelector('.rel-picker[data-media-id]')?.getAttribute('data-media-id') !== mediaId) {
      throw new Error('Pagina del titolo non disponibile. Accedi al sito e riprova.');
    }
    const context = readDocument(snapshotDocument, sourceUrl);
    if (keys.some((key) => !context.variants.some((variant) => variant.key === key))) {
      throw new Error('Versioni cambiate. Aggiorna il pannello e riprova.');
    }
    return { context, entries: new Map(entries(snapshotDocument).map((entry) => [entry.key, entry])) };
  };

  let fresh = await refresh();
  const thanked: string[] = [];
  const already: string[] = [];
  const failed: ThanksFailure[] = [];
  const accepted: string[] = [];
  for (const key of keys) {
    if (fresh.context.variants.find((variant) => variant.key === key)?.links.length) {
      already.push(key); continue;
    }
    try {
      const entry = fresh.entries.get(key);
      const button = entry?.panel.querySelector<HTMLButtonElement>('button[data-thanks][data-release-key]');
      if (!entry || !button || button.getAttribute('data-release-key') !== entry.releaseKey) {
        throw new Error('Pulsante Ringrazia non disponibile per questa versione.');
      }
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') {
        throw new Error('Ringraziamento non disponibile o già in corso.');
      }
      await request('https://titanhd.space/api/media/thanks', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mediaId, releaseKey: entry.releaseKey }),
      });
      accepted.push(key);
    } catch (reason) {
      failed.push({ key, error: reason instanceof Error ? reason.message : 'Ringraziamento non riuscito.' });
    }
  }
  if (accepted.length) {
    try {
      fresh = await refresh();
      for (const key of accepted) {
        if (fresh.context.variants.find((variant) => variant.key === key)?.links.length) thanked.push(key);
        else failed.push({ key, error: 'Ringraziamento inviato, ma link non ancora disponibili.' });
      }
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : 'errore sconosciuto';
      failed.push(...accepted.map((key) => ({ key, error: `Ringraziamento inviato; aggiornamento non riuscito: ${detail}` })));
    }
  }
  refreshedPages.set(document, fresh.context);
  return { context: fresh.context, thanks: { thanked, already, failed } };
}

export const titanHdAdapter: SiteAdapter = {
  id: 'titanhd',
  name: 'TitanHD',
  patterns: ['https://titanhd.space/catalogo/*'],
  matches(value) { try { pageUrl(value); return true; } catch { return false; } },
  normalizeUrl: pageUrl,
  readPage,
  thankSelected,
};

