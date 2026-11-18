import type { EmbyPresenceResult } from '../domain/emby';

export type EmbyStatus =
  | { state: 'idle' | 'checking' }
  | EmbyPresenceResult
  | { state: 'unavailable'; message: string };

export interface EmbyStatusRenderOptions {
  loadingSeasonId?: string | null;
  seasonError?: string | null;
  onSeasonSelect?(seasonId: string): void;
}

export interface EmbySeasonFilesResult {
  seasonId: string;
  files: string[];
}

function led(document: Document, state: EmbyStatus['state']): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = `emby-led ${state}`;
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export function renderEmbyStatus(
  container: HTMLElement,
  status: EmbyStatus,
  options: EmbyStatusRenderOptions = {},
): void {
  const document = container.ownerDocument;
  container.replaceChildren();
  container.className = `emby-status ${status.state}`;

  const heading = document.createElement('strong');
  heading.className = 'emby-heading';
  heading.textContent = 'Libreria Emby';
  container.append(heading);

  if (status.state === 'present' && status.series) {
    const seasons = document.createElement('div');
    seasons.className = 'emby-season-list';
    seasons.setAttribute('aria-label', 'Stagioni presenti in Emby');
    for (const season of status.series.seasons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'emby-season-button';
      button.textContent = `S${String(season.number).padStart(2, '0')}`;
      button.title = season.name;
      button.setAttribute('aria-pressed', String(season.id === status.series.selectedSeasonId));
      button.disabled = options.loadingSeasonId === season.id;
      button.addEventListener('click', () => options.onSeasonSelect?.(season.id));
      seasons.append(button);
    }
    container.append(seasons);
  }

  const list = document.createElement('div');
  list.className = 'emby-file-list';
  container.append(list);

  if (status.state === 'present' || status.state === 'ambiguous') {
    const selectedSeries = status.state === 'present' ? status.series : undefined;
    const selectedSeasonId = selectedSeries?.selectedSeasonId ?? null;
    const loading = selectedSeasonId !== null && options.loadingSeasonId === selectedSeasonId;
    const message = selectedSeries && status.files.length === 0
      ? options.seasonError ?? (loading ? 'Caricamento episodio 1…' : 'Episodio 1 non presente.')
      : null;
    const files = status.files.length ? status.files
      : message ? [] : ['Nome file non disponibile'];
    if (message) {
      const row = document.createElement('div');
      row.className = 'emby-file-row';
      row.append(led(document, options.seasonError ? 'unavailable' : loading ? 'checking' : 'absent'), message);
      list.append(row);
    }
    for (const file of files) {
      const row = document.createElement('div');
      row.className = 'emby-file-row';
      const name = document.createElement('span');
      name.className = 'emby-file-name';
      name.textContent = file;
      row.append(led(document, status.state === 'present' ? 'present' : 'ambiguous'), name);
      list.append(row);
    }
  } else {
    const row = document.createElement('div');
    row.className = 'emby-file-row';
    row.append(led(document, status.state));
    if (status.state === 'idle') row.append('Valida il titolo per controllare la libreria.');
    if (status.state === 'checking') row.append('Controllo in corso…');
    if (status.state === 'absent') row.append('Nessun file trovato.');
    if (status.state === 'unavailable') row.append(status.message);
    list.append(row);
  }

  const label = document.createElement('span');
  label.className = 'emby-result-label';
  label.textContent = {
    idle: 'In attesa',
    checking: 'Verifica',
    present: 'Presente',
    absent: 'Assente',
    ambiguous: 'Ambiguo',
    unavailable: 'Non verificabile',
  }[status.state];
  container.append(label);
}

type SeasonLoader = (seriesId: string, seasonId: string) => Promise<EmbySeasonFilesResult>;

export class EmbyPanelController {
  private status: EmbyStatus = { state: 'idle' };
  private readonly cache = new Map<string, string[]>();
  private revision = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly loadSeason: SeasonLoader,
  ) {}

  setStatus(status: EmbyStatus): void {
    this.revision += 1;
    this.cache.clear();
    this.status = status;
    if (status.state === 'present' && status.series?.selectedSeasonId) {
      this.cache.set(status.series.selectedSeasonId, [...status.files]);
    }
    this.render();
  }

  async selectSeason(seasonId: string): Promise<void> {
    const current = this.status;
    if (current.state !== 'present' || !current.series
      || !current.series.seasons.some((season) => season.id === seasonId)) return;
    const revision = ++this.revision;
    const cached = this.cache.get(seasonId);
    this.status = {
      ...current,
      files: cached ? [...cached] : [],
      series: { ...current.series, selectedSeasonId: seasonId },
    };
    if (cached) {
      this.render();
      return;
    }
    this.render({ loadingSeasonId: seasonId });
    try {
      const result = await this.loadSeason(current.series.seriesId, seasonId);
      if (revision !== this.revision || result.seasonId !== seasonId) return;
      this.cache.set(seasonId, [...result.files]);
      this.status = { ...this.status, files: [...result.files] } as EmbyPresenceResult;
      this.render();
    } catch (reason) {
      if (revision !== this.revision) return;
      this.render({
        seasonError: reason instanceof Error ? reason.message : 'Controllo stagione Emby non riuscito.',
      });
    }
  }

  private render(options: EmbyStatusRenderOptions = {}): void {
    renderEmbyStatus(this.container, this.status, {
      ...options,
      onSeasonSelect: (seasonId) => { void this.selectSeason(seasonId); },
    });
  }
}
