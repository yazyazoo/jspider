import type { PageSnapshot } from '../domain/models';
import type { CreateModeState } from '../domain/create-mode';
import type { TmdbSearchInput, TmdbSearchResult } from '../domain/tmdb';
import type { MediaRatings, MdbListLookupInput } from '../domain/media-ratings';
import { shouldAutoSearchTmdb } from './state';

export type TmdbSearch = (input: TmdbSearchInput) => Promise<TmdbSearchResult>;
export type MediaRatingsLookup = (input: MdbListLookupInput) => Promise<MediaRatings>;

export async function loadCandidateEnrichments(
  candidates: readonly { id: number; mediaKind: 'movie' | 'tv' }[],
  configured: boolean,
  lookup: MediaRatingsLookup,
): Promise<Map<number, MediaRatings>> {
  const enrichments = new Map<number, MediaRatings>();
  if (!configured) return enrichments;
  await Promise.all(candidates.map(async (candidate) => {
    try {
      enrichments.set(candidate.id, await lookup({
        tmdbId: candidate.id,
        mediaKind: candidate.mediaKind,
      }));
    } catch {
      // Ratings are optional: one failed lookup must not hide the TMDB candidate.
    }
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

