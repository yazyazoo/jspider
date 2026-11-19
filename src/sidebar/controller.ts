import type { PageSnapshot } from '../domain/models';
import type { CreateModeState } from '../domain/create-mode';
import type { TmdbSearchInput, TmdbSearchResult } from '../domain/tmdb';
import {
  normalizeMdbListMedia,
  type MediaAwards,
  type MediaRatings,
  type MdbListLookupInput,
} from '../domain/media-ratings';
import type { JustWatchLookupInput } from '../background/justwatch-client';
import { shouldAutoSearchTmdb } from './state';

export type TmdbSearch = (input: TmdbSearchInput) => Promise<TmdbSearchResult>;
export type MediaRatingsLookup = (input: MdbListLookupInput) => Promise<MediaRatings>;
export type JustWatchLookup = (input: JustWatchLookupInput) => Promise<MediaRatings['ratings'][number] | null>;
export type OmdbAwardsLookup = (imdbId: string) => Promise<MediaAwards | null>;

function directImdbId(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const match = url.origin === 'https://www.imdb.com'
      ? url.pathname.match(/^\/title\/(tt\d+)\/?$/) : null;
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function loadCandidateEnrichments(
  candidates: readonly {
    id: number;
    mediaKind: 'movie' | 'tv';
    title: string;
    year: string;
    imdbUrl?: string;
  }[],
  configured: boolean,
  lookup: MediaRatingsLookup,
  justWatchLookup: JustWatchLookup = async () => null,
  omdbConfigured = false,
  omdbAwardsLookup: OmdbAwardsLookup = async () => null,
): Promise<Map<number, MediaRatings>> {
  const enrichments = new Map<number, MediaRatings>();
  await Promise.all(candidates.map(async (candidate) => {
    const input: MdbListLookupInput = {
      tmdbId: candidate.id,
      mediaKind: candidate.mediaKind,
      title: candidate.title,
      year: candidate.year,
    };
    let enrichment = normalizeMdbListMedia({}, input);
    if (configured) try {
      const loaded = await lookup(input);
      const fallback = enrichment;
      const bySource = new Map(fallback.ratings.map((rating) => [rating.source, rating]));
      for (const rating of loaded.ratings) bySource.set(rating.source, rating);
      enrichment = {
        ratings: fallback.ratings.map((rating) => bySource.get(rating.source) ?? rating),
        awards: loaded.awards,
        imdbId: loaded.imdbId,
      };
    } catch {
      // MDBList is optional; fallback provider searches remain available.
    }
    const imdbId = enrichment.imdbId ?? directImdbId(candidate.imdbUrl);
    if (imdbId !== enrichment.imdbId) enrichment = { ...enrichment, imdbId };
    if (omdbConfigured && !enrichment.awards && imdbId) try {
      const awards = await omdbAwardsLookup(imdbId);
      if (awards) enrichment = { ...enrichment, awards };
    } catch {
      // OMDb awards are optional and must never block candidate validation.
    }
    try {
      const justWatch = await justWatchLookup({ ...input, imdbId: enrichment.imdbId });
      if (justWatch) {
        enrichment = {
          ...enrichment,
          ratings: enrichment.ratings.map((rating) =>
            rating.source === 'justwatch' ? justWatch : rating),
        };
      }
    } catch {
      // JustWatch is undocumented and must never hide the fallback link.
    }
    enrichments.set(candidate.id, enrichment);
  }));
  return enrichments;
}

export function applyCreateModeView(
  state: CreateModeState,
  view: {
    quickPanel: HTMLElement;
    taskflowPanel: HTMLElement;
    quickChoice: HTMLInputElement;
    taskflowChoice: HTMLInputElement;
  },
): void {
  const quick = state.selected === 'quick';
  view.quickPanel.hidden = !quick;
  view.taskflowPanel.hidden = quick;
  view.quickChoice.checked = quick;
  view.taskflowChoice.checked = !quick;
  view.quickChoice.disabled = state.locked;
  view.taskflowChoice.disabled = state.locked;
}

export function autoSearchSnapshot(
  snapshot: PageSnapshot,
  configured: boolean,
  search: TmdbSearch,
): Promise<TmdbSearchResult | null> {
  if (!shouldAutoSearchTmdb(configured, snapshot.mediaKind)
    || (snapshot.mediaKind !== 'movie' && snapshot.mediaKind !== 'tv')) {
    return Promise.resolve(null);
  }
  return search({
    title: snapshot.title,
    year: snapshot.year,
    mediaKind: snapshot.mediaKind,
    imdbId: snapshot.imdbId,
    mode: 'auto',
  });
}

export class LatestResultGate {
  #revision = 0;

  async run<T>(operation: () => Promise<T>): Promise<T | null> {
    const revision = ++this.#revision;
    try {
      const result = await operation();
      return revision === this.#revision ? result : null;
    } catch (reason) {
      if (revision !== this.#revision) return null;
      throw reason;
    }
  }

  invalidate(): void {
    this.#revision += 1;
  }
}

export function clearTmdbView(view: {
  results: HTMLElement;
  validation: HTMLElement;
}): void {
  view.results.replaceChildren();
  view.validation.textContent = '';
}

export async function initializeOverlayWidthControl(
  pageUrl: string,
  view: { container: HTMLElement; select: HTMLSelectElement },
  getStatus: () => Promise<{ open: boolean; width: number }>,
): Promise<boolean> {
  let overlay = false;
  try { overlay = new URL(pageUrl).searchParams.get('surface') === 'overlay'; }
  catch { overlay = false; }
  if (!overlay) return false;
  view.container.hidden = false;
  const status = await getStatus();
  view.select.value = String(status.width);
  return true;
}

export interface SidebarStartupDependencies {
  loadSettings(): Promise<void>;
  initializeOverlayWidth(): Promise<void>;
  loadCatalog(): Promise<void>;
  readSnapshot(): Promise<void>;
}

export async function runSidebarStartup(dependencies: SidebarStartupDependencies): Promise<void> {
  await Promise.all([
    dependencies.loadSettings(),
    dependencies.initializeOverlayWidth(),
  ]);
  void dependencies.loadCatalog().catch(() => undefined);
  await dependencies.readSnapshot();
}

