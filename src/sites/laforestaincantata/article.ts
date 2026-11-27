import { normalizeArchiveUrl } from '../../domain/archive-links';
import type { MediaKind, PageSnapshot, ReleaseVariant } from '../../domain/models';
import { requireSiteDefinition } from '../catalog';
import type { ArticleAdapter, ThanksFailure, ThanksResult } from '../contracts';
import { normalizeLfiCryptUrl, resolveLfiCrypt } from './lficrypt';
import { domText, parseLfiTechnical } from './technical';

const ORIGIN = 'https://laforestaincantata.org';
const siteDefinition = requireSiteDefinition('laforestaincantata');

interface Identity {
  title: string;
  year: string;
  seasons: number[];
  aliases: string[];
  mediaKind: MediaKind | '';
}

interface ForestaState {
  sourceUrl: string;
  identity: Identity;
  liveMarkup: string | undefined;
  pages: Map<string, PageSnapshot>;
  warnings: string[];
}

const states = new WeakMap<Document, ForestaState>();
const clean = (value: unknown) => String(value ?? '').replace(/[\t \u00a0]+/g, ' ').trim();
const normalized = (value: unknown) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function normalizeUrl(value: string): string {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.hostname !== 'laforestaincantata.org'
    || url.username || url.password || url.port || url.pathname !== '/index.php'
    || url.searchParams.getAll('newsid').length !== 1
    || !/^[1-9]\d*$/.test(url.searchParams.get('newsid') ?? '')) {
    throw new Error('Apri un articolo della Foresta Incantata.');
  }
  return `${ORIGIN}/index.php?newsid=${url.searchParams.get('newsid')}`;
}

function identity(raw: string, body = ''): Identity {
  const year = raw.match(/\((19\d{2}|20\d{2})/)?.[1] ?? '';
  const seasonText = raw.match(/stagion[ei]\s+(\d+(?:\s*[-–,/]\s*\d+)*)/i)?.[1];
  let seasons = seasonText ? [...new Set((seasonText.match(/\d+/g) ?? []).map(Number))] : [];
  if (seasonText && seasons.length === 2 && /[-–]/.test(seasonText)
    && seasons[1]! > seasons[0]! && seasons[1]! - seasons[0]! < 100) {
    seasons = Array.from({ length: seasons[1]! - seasons[0]! + 1 }, (_, index) => seasons[0]! + index);
  }
  const episodic = /\b(?:S\d{1,2}E?\d*|serie\s*tv|stagion[ei])\b/i.test(raw);
  const title = clean(raw.split(/\s*[-–—:]?\s*stagion[ei]\b|\s*\((?:19|20)\d{2}/i)[0])
    .replace(/\s*[-–—:]\s*$/, '');
  const aliases = [title];
  for (const line of body.split('\n')) {
    const match = line.match(/^\s*Titolo (?:originale|italiano)\s*:\s*(.+)$/i);
    if (match?.[1]) aliases.push(clean(match[1]));
  }
  const mediaKind: MediaKind | '' = episodic ? 'tv'
    : /\b(?:web[ .-]?dl|blu[ .-]?ray|b[dr]rip|untouched|1080p|2160p|720p|4k|full\s*hd)\b/i.test(raw)
      ? 'movie' : '';
  return { title, year, seasons, aliases: aliases.map(normalized).filter(Boolean), mediaKind };
}

function sameTitle(left: Identity, right: Identity): boolean {
  return Boolean(left.title && right.title && left.mediaKind && left.mediaKind === right.mediaKind
    && left.year && left.year === right.year && left.seasons.join(',') === right.seasons.join(',')
    && left.aliases.some((alias) => right.aliases.includes(alias)));
}

function urls(node: Element): string[] {
  const values = [...node.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLAnchorElement>('a[href],textarea,input[name="urls"],[data-jd-link]')]
    .flatMap((element) => [element.getAttribute('href'), 'value' in element ? element.value : null, element.getAttribute('data-jd-link')])
    .filter((value): value is string => Boolean(value));
  values.push(domText(node));
  return [...new Set(values.flatMap((value) => value.match(/https?:\/\/[^\s<>"']+/gi) ?? [])
    .map((value) => value.replace(/[),.;]+$/, '')))];
}

function password(node: Element): string {
  const explicit = [...node.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[name="passwords"],textarea[name="passwords"]')]
    .map((element) => element.value).find(Boolean);
  if (explicit) return clean(explicit);
  const found = domText(node).match(/^\s*(?:password(?:\s+(?:archivio|rar|archivi|estrazione))?|psw)\s*:\s*([^\r\n]+)$/im);
  return found?.[1] ? clean(found[1]) : '';
}

function readDocument(document: Document, value: string): PageSnapshot {
  const sourceUrl = normalizeUrl(value);
  const articleId = new URL(sourceUrl).searchParams.get('newsid') ?? '';
  const story = document.querySelector('#full-story');
  if (!story) throw new Error('Articolo non leggibile: verifica di essere connesso alla Foresta.');
  const raw = clean(document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content
    ?? document.querySelector('#dle-content .title')?.textContent ?? document.title.split(' » ')[0]);
  if (!raw) throw new Error('Titolo articolo non disponibile.');
  const info = identity(raw, domText(story));
  const cards = [...story.querySelectorAll('[data-film-version-card]')];
  const articleLocked = Boolean(story.querySelector('#thx [onclick*="tanksForNews"]'));
  const allCodings = /\btutte\s+le\s+codifiche(?:\s+disponibili)?\b/i.test(raw);
  const outsideCards = story.cloneNode(true) as Element;
  outsideCards.querySelectorAll('[data-film-version-card]').forEach((element) => element.remove());
  const commonPassword = password(outsideCards);
  const seen = new Map<string, number>();
  const variants: ReleaseVariant[] = (cards.length ? cards : [story]).map((card) => {
    const label = clean(card.querySelector('.film-version-card-read__badge,.film-version-card-read__title,.film-version-name,.film-version-title,.film-version-card__title')?.textContent
      ?? card.querySelector('[data-report-panel] .film-version-report__title')?.textContent?.replace(/^Report\s*-\s*/i, '')
      ?? (cards.length ? domText(card).trim().split('\n').find((line) => clean(line)) : ''));
    const foundUrls = urls(card);
    const directLinks = foundUrls.map(normalizeArchiveUrl).filter((link): link is string => link !== null);
    const collectors = foundUrls.map(normalizeLfiCryptUrl).filter((link): link is string => link !== null);
    const unsupportedCollectors = foundUrls.filter((url) => {
      try { return /(?:^|\.)filecrypt\.(?:cc|co|to)$/i.test(new URL(url).hostname); }
      catch { return false; }
    });
    const slug = cards.length ? normalized(label || 'versione').replace(/ /g, '-') : 'article';
    const count = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, count);
    const key = `foresta:${articleId}:${slug}${count > 1 ? `-${count}` : ''}`;
    const reportNodes = cards.length ? [...card.querySelectorAll('[data-report-panel]')]
      : [...card.querySelectorAll('.text_spoiler,pre')];
    const report = reportNodes.map(domText)
      .filter((text) => /\b(?:Video|Traccia video|Video track|Codec ID|Format|Formato)\b/i.test(text)).join('\n');
    const technical = parseLfiTechnical(report, cards.length ? `${label} ${raw}` : raw);
    return {
      key, packageName: cards.length ? `${info.title}${info.year ? ` (${info.year})` : ''} — ${label}` : raw,
      articleUrl: sourceUrl, articleId, password: password(card) || commonPassword,
      links: [...new Set(directLinks)], collectors: [...new Set(collectors)],
      unsupportedCollectors,
      linksLoaded: !articleLocked || cards.length > 0 || directLinks.length > 0 || collectors.length > 0,
      technical,
      ...(!cards.length && articleLocked && directLinks.length === 0 && collectors.length === 0
        ? { locked: true }
        : {}),
      ...(info.seasons.length === 1 ? { season: info.seasons[0]!, technicalSample: true } : {}),
    };
  });
  const imdbId = [...story.querySelectorAll<HTMLAnchorElement>('a[href]')].flatMap((anchor) => {
    try {
      const url = new URL(anchor.href);
      const match = /^(?:www\.)?imdb\.com$/.test(url.hostname) ? url.pathname.match(/^\/title\/(tt\d+)\/?$/) : null;
      return match?.[1] ? [match[1]] : [];
    } catch { return []; }
  })[0] ?? '';
  return {
    siteId: 'laforestaincantata', siteName: 'La Foresta Incantata', sourceUrl,
    title: info.title, year: info.year, mediaKind: info.mediaKind, imdbId,
    supportsThanks: true,
    thanksMode: allCodings
      ? articleLocked && cards.length === 0 ? 'unlock-container' : 'validate-selection'
      : 'selection',
    thanksHint: 'Il ringraziamento può costare 1 doblone per articolo. Più versioni dello stesso articolo vengono sbloccate insieme.',
    variants, warnings: [],
  };
}

function snapshotIdentity(snapshot: PageSnapshot): Identity {
  return identity(`${snapshot.title} (${snapshot.year}) ${snapshot.mediaKind === 'tv' ? 'serie tv' : 'WEB-DL'}`);
}

function markup(document: Document): string | undefined {
  return document.querySelector('#full-story')?.innerHTML;
}

function readPage(document: Document, value: string): PageSnapshot {
  const live = readDocument(document, value);
  const state = states.get(document);
  if (!state || state.sourceUrl !== live.sourceUrl || !sameTitle(state.identity, snapshotIdentity(live))) return live;
  if (state.liveMarkup !== markup(document)) {
    state.liveMarkup = markup(document);
    state.pages.set(live.sourceUrl, live);
  }
  const primary = state.pages.get(live.sourceUrl) ?? live;
  return {
    ...primary,
    variants: [...state.pages.values()].flatMap((page) => page.variants),
    warnings: [...state.warnings],
  };
}

function client(document: Document) {
  const fetcher = document.defaultView?.fetch?.bind(document.defaultView) ?? globalThis.fetch;
  if (typeof fetcher !== 'function') throw new Error('Connessione al sito non disponibile.');
  const request = async (url: string, init: RequestInit = {}): Promise<string> => {
    if (new URL(url).origin !== ORIGIN) throw new Error('Destinazione non autorizzata.');
    const response = await fetcher(url, {
      method: 'GET', ...init, credentials: 'same-origin', redirect: 'error', cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Sito non disponibile (${response.status}).`);
    return response.text();
  };
  const page = async (url: string) => {
    const target = normalizeUrl(url);
    const parser = document.defaultView?.DOMParser ?? globalThis.DOMParser;
    return readDocument(new parser().parseFromString(await request(target), 'text/html'), target);
  };
  const resolve = async (context: PageSnapshot) => {
    for (const variant of context.variants) {
      const links = [...variant.links];
      const errors: string[] = [];
      delete variant.linkError;
      for (const collector of variant.collectors ?? []) {
        try {
          links.push(...await resolveLfiCrypt(collector, async (target) => JSON.parse(await request(
            `${ORIGIN}/engine/ajax/lficrypt_links.php?url=${encodeURIComponent(target)}`,
          ))));
        } catch (reason) { errors.push(reason instanceof Error ? reason.message : 'errore sconosciuto'); }
      }
      variant.links = [...new Set(links)];
      if (errors.length) variant.linkError = `LFiCrypt: ${errors.join(' ')}`;
      if (variant.unsupportedCollectors?.length) {
        variant.linkError = `${variant.linkError ? `${variant.linkError} ` : ''}Filecrypt non è supportato da JSpider.`;
      }
    }
    return context;
  };
  return { request, page, resolve };
}

function related(document: Document, sourceUrl: string): string[] {
  const anchors = [...document.querySelectorAll<HTMLAnchorElement>('#lfi-similar-section a[href],#ajax-articolisimili a[href],#full-story a[href]')];
  return [...new Set(anchors.flatMap((anchor) => {
    try {
      const url = normalizeUrl(new URL(anchor.getAttribute('href') ?? '', sourceUrl).href);
      return url === sourceUrl ? [] : [url];
    } catch { return []; }
  }))];
}

async function loadPage(document: Document, value: string): Promise<PageSnapshot> {
  const live = readDocument(document, value);
  const network = client(document);
  const primary = await network.resolve(live);
  const state: ForestaState = {
    sourceUrl: primary.sourceUrl, identity: snapshotIdentity(primary),
    liveMarkup: markup(document), pages: new Map([[primary.sourceUrl, primary]]), warnings: [],
  };
  const candidates = related(document, primary.sourceUrl);
  if (candidates.length > 20) state.warnings.push('Mostrati al massimo 20 articoli collegati.');
  const targets = candidates.slice(0, 20);
  const results: Array<{ target: string; page?: PageSnapshot; error?: string }> = new Array(targets.length);
  let next = 0;
  const reader = async () => {
    while (next < targets.length) {
      const index = next++;
      const target = targets[index];
      if (!target) continue;
      try {
        const page = await network.page(target);
        if (sameTitle(state.identity, snapshotIdentity(page))) {
          results[index] = { target, page: await network.resolve(page) };
        } else results[index] = { target };
      } catch (reason) {
        results[index] = {
          target,
          error: `Articolo ${new URL(target).searchParams.get('newsid')} non letto: ${reason instanceof Error ? reason.message : 'errore sconosciuto'}`,
        };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, targets.length) }, reader));
  for (const result of results) {
    if (result?.page) state.pages.set(result.target, result.page);
    if (result?.error) state.warnings.push(result.error);
  }
  states.set(document, state);
  return readPage(document, value);
}

async function thankSelected(
  document: Document,
  value: string,
  variantKeys: readonly string[],
): Promise<ThanksResult> {
  const current = readPage(document, value);
  const selection = [...new Set(variantKeys)];
  if (!selection.length || selection.some((key) => !current.variants.some((variant) => variant.key === key))) {
    throw new Error('Seleziona versioni disponibili prima di ringraziare.');
  }
  const existing = states.get(document);
  const state: ForestaState = existing && existing.sourceUrl === current.sourceUrl
    ? existing
    : {
      sourceUrl: current.sourceUrl, identity: snapshotIdentity(current),
      liveMarkup: markup(document), pages: new Map([[current.sourceUrl, current]]), warnings: [],
    };
  const network = client(document);
  const thanked: string[] = [];
  const already: string[] = [];
  const failed: ThanksFailure[] = [];
  const replacements: Record<string, string[]> = {};
  const groups = new Map<string, string[]>();
  for (const key of selection) {
    const variant = current.variants.find((item) => item.key === key);
    if (!variant?.articleUrl) throw new Error('Articolo sorgente della versione non disponibile.');
    const group = groups.get(variant.articleUrl) ?? [];
    group.push(key);
    groups.set(variant.articleUrl, group);
  }

  for (const [target, selectedKeys] of groups) {
    try {
      let fresh = await network.page(target);
      if (!sameTitle(snapshotIdentity(current), snapshotIdentity(fresh))) {
        throw new Error('Titolo, anno o stagione dell’articolo sono cambiati. Aggiorna il pannello.');
      }
      const wasLocked = fresh.variants.some((variant) => variant.locked);
      if (wasLocked) {
        if (selectedKeys.some((key) => !current.variants.find((variant) => variant.key === key)?.locked)) {
          throw new Error('L’accesso ai link è cambiato. Aggiorna il pannello prima di ringraziare.');
        }
        let postError: Error | undefined;
        try {
          const newsId = new URL(target).searchParams.get('newsid') ?? '';
          const body = new URLSearchParams({ thanks: 'tanksForNews', news_id: newsId }).toString();
          const responseText = await network.request(`${ORIGIN}/engine/ajax/thanks.php`, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body,
          });
          if (responseText.startsWith('LFI_DOBLONI_ERROR:')) {
            throw new Error(responseText.slice('LFI_DOBLONI_ERROR:'.length).trim().slice(0, 300));
          }
        } catch (reason) {
          postError = reason instanceof Error ? reason : new Error('Ringraziamento non riuscito.');
        }
        fresh = await network.page(target);
        if (!sameTitle(snapshotIdentity(current), snapshotIdentity(fresh))
          || fresh.variants.some((variant) => variant.locked)) {
          throw postError ?? new Error('Ringraziamento non confermato dal sito.');
        }
      }
      fresh = await network.resolve(fresh);
      state.pages.set(target, fresh);
      for (const key of selectedKeys) {
        (wasLocked ? thanked : already).push(key);
        if (!fresh.variants.some((variant) => variant.key === key)) {
          replacements[key] = fresh.variants.map((variant) => variant.key);
        }
      }
      if (target === current.sourceUrl && wasLocked) {
        const widget = document.querySelector('#thx');
        if (widget) {
          widget.replaceChildren(document.createTextNode('Articolo ringraziato · link aggiornati nel pannello JSpider'));
          state.liveMarkup = markup(document);
        }
      }
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : 'Ringraziamento non riuscito.';
      failed.push(...selectedKeys.map((key) => ({ key, error })));
    }
  }
  states.set(document, state);
  return { context: readPage(document, value), thanks: { thanked, already, failed, replacements } };
}

export const laForestaAdapter: ArticleAdapter = {
  id: siteDefinition.siteId,
  name: siteDefinition.siteName,
  patterns: [...siteDefinition.articleMatches],
  matches(value) {
    try { return new URL(value).protocol === 'https:' && Boolean(normalizeUrl(value)); }
    catch { return false; }
  },
  normalizeUrl,
  readPage,
  loadPage,
  thankSelected,
};

