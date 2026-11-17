type Fetcher = (request: Request) => Promise<Response>;

export class TmdbClient {
  readonly #credential: string;
  readonly #fetcher: Fetcher;

  constructor(credential: string, fetcher: Fetcher = (request) => fetch(request)) {
    this.#credential = credential.trim();
    if (!this.#credential) throw new Error('Configura il token o la API key TMDB.');
    this.#fetcher = fetcher;
  }

  async request(path: string, params: Record<string, unknown>): Promise<unknown> {
    if (!/^\/[a-z0-9/_-]+$/i.test(path)) throw new Error('Percorso TMDB non valido.');
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const v3Key = /^[a-f0-9]{32}$/i.test(this.#credential);
    if (v3Key) url.searchParams.set('api_key', this.#credential);
    const request = new Request(url, {
      headers: {
        accept: 'application/json',
        ...(!v3Key ? { authorization: `Bearer ${this.#credential}` } : {}),
      },
    });
    let response: Response;
    try { response = await this.#fetcher(request); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Connessione a TMDB non riuscita.';
      throw new Error(message.split(this.#credential).join('[redacted]'));
    }
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new Error('TMDB ha restituito JSON non valido.'); }
    if (!response.ok) {
      const message = body !== null && typeof body === 'object' && !Array.isArray(body)
        && typeof (body as Record<string, unknown>).status_message === 'string'
        ? String((body as Record<string, unknown>).status_message)
        : `TMDB ha risposto HTTP ${response.status}.`;
      throw new Error(message.split(this.#credential).join('[redacted]'));
    }
    return body;
  }
}

