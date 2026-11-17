import type { SubmissionRequest } from '../domain/taskflow-contract';
import type { TaskFlowPipelineApi, WorkflowRecord } from '../domain/taskflow-pipeline';
import { normalizeTaskFlowBaseUrl } from '../domain/taskflow-url';

type Fetcher = (request: Request) => Promise<Response>;

export class TaskFlowHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly response: unknown;

  constructor(status: number, code: string, message: string, response: unknown = null) {
    super(message);
    this.name = 'TaskFlowHttpError';
    this.status = status;
    this.code = code;
    this.response = response;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeNetworkError(reason: unknown, token: string): Error {
  const message = reason instanceof Error ? reason.message : 'Connessione a TaskFlow non riuscita.';
  return new Error(token ? message.split(token).join('[redacted]') : message);
}

export class TaskFlowClient implements TaskFlowPipelineApi {
  readonly baseUrl: string;
  readonly #token: string;
  readonly #fetcher: Fetcher;

  constructor(baseUrl: string, token: string, fetcher: Fetcher = (request) => fetch(request)) {
    this.baseUrl = normalizeTaskFlowBaseUrl(baseUrl);
    this.#token = token.trim();
    if (!this.#token) throw new Error('Configura il token amministrativo TaskFlow.');
    this.#fetcher = fetcher;
  }

  async #request(path: string, init: RequestInit = {}): Promise<unknown> {
    const request = new Request(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.#token}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    let response: Response;
    try { response = await this.#fetcher(request); }
    catch (reason) { throw safeNetworkError(reason, this.#token); }
    let body: unknown = null;
    try { body = response.status === 204 ? null : await response.json(); }
    catch { throw new TaskFlowHttpError(response.status, 'client.invalid_json', 'TaskFlow ha restituito JSON non valido.'); }
    if (!response.ok) {
      const error = isRecord(body) && isRecord(body.error) ? body.error : {};
      throw new TaskFlowHttpError(
        response.status,
        typeof error.code === 'string' ? error.code : 'api.request_failed',
        typeof error.message === 'string' ? error.message : `TaskFlow ha risposto HTTP ${response.status}.`,
        body,
      );
    }
    return body;
  }

  async discoverJDownloaderIntegration(): Promise<string> {
    const raw = await this.#request('/api/v1/integrations');
    if (!Array.isArray(raw)) throw new Error('Elenco integrazioni TaskFlow non valido.');
    const match = raw.find((item) => isRecord(item) && item.type === 'jdownloader'
      && item.enabled !== false && typeof item.id === 'string' && item.id.length > 0);
    if (!isRecord(match) || typeof match.id !== 'string') {
      throw new Error('Nessuna integrazione JDownloader abilitata in TaskFlow.');
    }
    return match.id;
  }

  getPresets(): Promise<unknown> {
    return this.#request('/api/v1/workflow-presets');
  }

  submitPackages(integrationId: string, request: SubmissionRequest): Promise<unknown> {
    return this.#request(`/api/v1/integrations/${encodeURIComponent(integrationId)}/submission`, {
      method: 'POST', body: JSON.stringify(request),
    });
  }

  async createWorkflow(payload: Record<string, unknown>): Promise<WorkflowRecord> {
    const raw = await this.#request('/api/v1/workflows', {
      method: 'POST', body: JSON.stringify(payload),
    });
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) {
      throw Object.assign(new Error('Risposta Create di TaskFlow non valida.'), { response: raw });
    }
    return raw as WorkflowRecord;
  }

  async startWorkflow(workflowId: string): Promise<WorkflowRecord> {
    const raw = await this.#request(`/api/v1/workflows/${encodeURIComponent(workflowId)}/start`, {
      method: 'POST',
    });
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) {
      throw Object.assign(new Error('Risposta Start di TaskFlow non valida.'), { response: raw });
    }
    return raw as WorkflowRecord;
  }
}

