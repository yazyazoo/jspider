import { normalizeMdbListMedia, type MdbListLookupInput, type MediaRatings } from '../domain/media-ratings';

type Fetcher = (request: Request) => Promise<Response>;

export class MdbListClient {
  readonly #apiKey: string;
  readonly #fetcher: Fetcher;

  constructor(apiKey: string, fetcher: Fetcher = (request) => fetch(request)) {
    this.#apiKey = apiKey.trim();
    if (!this.#apiKey) throw new Error('Configura la API key MDBList.');
    this.#fetcher = fetcher;
  }

  async lookup(input: MdbListLookupInput): Promise<MediaRatings> {
    if (!Number.isSafeInteger(input.tmdbId) || input.tmdbId <= 0) throw new Error('ID TMDB MDBList non valido.');
    const type = input.mediaKind === 'movie' ? 'movie' : 'show';
    const url = new URL(`https://api.mdblist.com/tmdb/${type}/${input.tmdbId}/`);
    url.searchParams.set('apikey', this.#apiKey);
    let response: Response;
    try { response = await this.#fetcher(new Request(url, { headers: { accept: 'application/json' } })); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Connessione a MDBList non riuscita.';
      throw new Error(message.split(this.#apiKey).join('[redacted]'));
    }
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new Error('MDBList ha restituito JSON non valido.'); }
    if (!response.ok) {
      const data = body !== null && typeof body === 'object' && !Array.isArray(body)
        ? body as Record<string, unknown> : {};
      const message = typeof data.error === 'string' ? data.error : `MDBList ha risposto HTTP ${response.status}.`;
      throw new Error(message.split(this.#apiKey).join('[redacted]'));
    }
    return normalizeMdbListMedia(body, input);
  }
}

