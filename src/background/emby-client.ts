import {
  episodeOneFilenames,
  matchingEmbyItems,
  resolveEmbyPresence,
  selectDefaultEmbySeason,
  type EmbyItem,
  type EmbyLookupInput,
  type EmbyPresenceResult,
  type EmbyResolutionInput,
  type EmbySeasonSummary,
} from '../domain/emby';

type Fetcher = (request: Request) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.search || url.hash) throw new Error('URL Emby non valido.');
  return url.toString().replace(/\/$/, '');
}

function item(value: unknown): EmbyItem | null {
  if (!isRecord(value)) return null;
  const providerIds = isRecord(value.ProviderIds)
    ? Object.fromEntries(Object.entries(value.ProviderIds)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : {};
  const mediaSources = Array.isArray(value.MediaSources)
    ? value.MediaSources.flatMap((source) => isRecord(source) && typeof source.Path === 'string'
      ? [{ path: source.Path }] : [])
    : [];
  return {
    id: typeof value.Id === 'string' ? value.Id : '',
    name: typeof value.Name === 'string' ? value.Name : '',
    type: typeof value.Type === 'string' ? value.Type : '',
    indexNumber: typeof value.IndexNumber === 'number' ? value.IndexNumber : null,
    productionYear: typeof value.ProductionYear === 'number' ? value.ProductionYear : null,
    path: typeof value.Path === 'string' ? value.Path : '',
    ...(typeof value.FileName === 'string' ? { fileName: value.FileName } : {}),
    providerIds,
    mediaSources,
  };
}

function endpoint(baseUrl: string): URL {
  return new URL(`${baseUrl}${/\/emby$/i.test(new URL(baseUrl).pathname) ? '' : '/emby'}/Items`);
}

function tvEndpoint(baseUrl: string, seriesId: string, resource: 'Seasons' | 'Episodes'): URL {
  const root = `${baseUrl}${/\/emby$/i.test(new URL(baseUrl).pathname) ? '' : '/emby'}`;
  return new URL(`${root}/Shows/${encodeURIComponent(seriesId)}/${resource}`);
}

function resolutionInput(input: EmbyLookupInput): EmbyResolutionInput {
  return input.mode === 'tmdb'
    ? { mode: 'tmdb' }
    : { mode: 'title', title: input.title, ...(input.year === undefined ? {} : { year: input.year }) };
}

export class EmbyClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly fetcher: Fetcher = (request) => fetch(request),
    private readonly timeoutMs = 10_000,
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    if (!token.trim()) throw new Error('Token Emby non configurato.');
  }

  private async getItems(url: URL): Promise<EmbyItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetcher(new Request(url, {
        method: 'GET',
        headers: { 'X-Emby-Token': this.token },
        signal: controller.signal,
      }));
    } catch (reason) {
      if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) {
        throw new Error('Emby non raggiungibile entro il tempo previsto.');
      }
      throw new Error('Server Emby non raggiungibile.');
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error('Token Emby non valido o non autorizzato.');
    }
    if (!response.ok) throw new Error(`Controllo Emby non riuscito (HTTP ${response.status}).`);

    let value: unknown;
    try { value = await response.json(); }
    catch { throw new Error('Risposta Emby non valida.'); }
    if (!isRecord(value) || !Array.isArray(value.Items)
      || typeof value.TotalRecordCount !== 'number') {
      throw new Error('Risposta Emby non valida.');
    }
    const items = value.Items.map(item).filter((entry): entry is EmbyItem => entry !== null);
    if (items.length !== value.Items.length) throw new Error('Risposta Emby non valida.');
    return items;
  }

  async lookup(input: EmbyLookupInput): Promise<EmbyPresenceResult> {
    const url = endpoint(this.baseUrl);
    url.searchParams.set('Recursive', 'true');
    url.searchParams.set('IncludeItemTypes', input.mediaKind === 'movie' ? 'Movie' : 'Series');
    url.searchParams.set('Fields', 'ProviderIds,Path');
    if (input.mode === 'tmdb') {
      url.searchParams.set('AnyProviderIdEquals', `tmdb.${input.tmdbId}`);
    } else {
      url.searchParams.set('SearchTerm', input.title);
      if (input.year !== undefined) url.searchParams.set('Years', String(input.year));
    }

    const items = await this.getItems(url);
    const matchInput = resolutionInput(input);
    const result = resolveEmbyPresence(items, matchInput);
    if (input.mediaKind !== 'tv' || result.state !== 'present') return result;

    const matchingSeries = matchingEmbyItems(items, matchInput);
    if (matchingSeries.length > 1) return { ...result, state: 'ambiguous' };
    const series = matchingSeries[0];
    if (!series?.id) throw new Error('Risposta Emby non valida.');
    const seasonItems = await this.getItems(tvEndpoint(this.baseUrl, series.id, 'Seasons'));
    const seasons = seasonItems.map<EmbySeasonSummary | null>((season) =>
      season.id && typeof season.indexNumber === 'number'
        ? { id: season.id, number: season.indexNumber, name: season.name }
        : null);
    if (seasons.some((season) => season === null)) throw new Error('Risposta Emby non valida.');
    const sortedSeasons = (seasons as EmbySeasonSummary[])
      .sort((left, right) => left.number - right.number);
    const selected = selectDefaultEmbySeason(sortedSeasons);
    const selectedFiles = selected
      ? (await this.lookupSeasonEpisodeOne(series.id, selected.id)).files
      : [];
    return {
      state: 'present',
      files: selectedFiles,
      series: {
        seriesId: series.id,
        seasons: sortedSeasons,
        selectedSeasonId: selected?.id ?? null,
      },
    };
  }

  async lookupSeasonEpisodeOne(
    seriesId: string,
    seasonId: string,
  ): Promise<{ seasonId: string; files: string[] }> {
    if (!seriesId.trim() || !seasonId.trim()) throw new Error('Identificatore Emby non valido.');
    const url = tvEndpoint(this.baseUrl, seriesId, 'Episodes');
    url.searchParams.set('SeasonId', seasonId);
    url.searchParams.set('Fields', 'Path,FileName,MediaSources');
    const episodes = await this.getItems(url);
    if (episodes.some((episode) => !episode.id || episode.type !== 'Episode'
      || typeof episode.indexNumber !== 'number')) {
      throw new Error('Risposta Emby non valida.');
    }
    const files = episodeOneFilenames(episodes);
    if (episodes.some((episode) => episode.indexNumber === 1) && files.length === 0) {
      throw new Error('Risposta Emby non valida.');
    }
    return { seasonId, files };
  }
}
