import type { MediaAwards } from '../domain/media-ratings';

type Fetcher = (request: Request) => Promise<Response>;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export class OmdbClient {
  readonly #apiKey: string;
  readonly #fetcher: Fetcher;

  constructor(apiKey: string, fetcher: Fetcher = (request) => fetch(request)) {
    this.#apiKey = apiKey.trim();
    if (!this.#apiKey) throw new Error('Configura la API key OMDb.');
    this.#fetcher = fetcher;
  }

  async lookupAwards(imdbId: string): Promise<MediaAwards | null> {
    if (!/^tt\d+$/.test(imdbId)) return null;
    const url = new URL('https://www.omdbapi.com/');
    url.searchParams.set('apikey', this.#apiKey);
    url.searchParams.set('i', imdbId);
    let response: Response;
    try { response = await this.#fetcher(new Request(url, { headers: { accept: 'application/json' } })); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Connessione a OMDb non riuscita.';
      throw new Error(message.split(this.#apiKey).join('[redacted]'));
    }
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new Error('OMDb ha restituito JSON non valido.'); }
    const data = record(body) ?? {};
    if (!response.ok) {
      const message = typeof data.Error === 'string'
        ? data.Error : `OMDb ha risposto HTTP ${response.status}.`;
      throw new Error(message.split(this.#apiKey).join('[redacted]'));
    }
    if (data.Response === 'False') return null;
    const text = typeof data.Awards === 'string' ? data.Awards.trim() : '';
    return text && text !== 'N/A'
      ? { text, url: `https://www.imdb.com/title/${imdbId}/awards/` }
      : null;
  }
}
