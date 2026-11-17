import type { QuickWorkflowLogEvent } from '../domain/taskflow-pipeline';

export interface QuickWorkflowLogStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface QuickWorkflowLogEntry extends QuickWorkflowLogEvent {
  timestamp: string;
}

export interface QuickWorkflowLogDocument {
  runId: string;
  startedAt: string;
  updatedAt: string;
  entries: QuickWorkflowLogEntry[];
}

const STORAGE_KEY = 'jspider.quickWorkflowLog';

function serializable(value: unknown): unknown {
  const seen = new WeakSet<object>();
  const json = JSON.stringify(value, (_key, candidate: unknown) => {
    if (typeof candidate === 'bigint') return candidate.toString();
    if (candidate !== null && typeof candidate === 'object') {
      if (seen.has(candidate)) return '[Circular]';
      seen.add(candidate);
    }
    return candidate;
  });
  return json === undefined ? null : JSON.parse(json) as unknown;
}

function isDocument(value: unknown): value is QuickWorkflowLogDocument {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<QuickWorkflowLogDocument>;
  return typeof candidate.startedAt === 'string'
    && typeof candidate.updatedAt === 'string'
    && typeof candidate.runId === 'string'
    && Array.isArray(candidate.entries);
}

export class QuickWorkflowLogStore {
  private operations: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: QuickWorkflowLogStorage,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly createRunId: () => string = () => crypto.randomUUID(),
  ) {}

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation, operation);
    this.operations = result.then(() => undefined, () => undefined);
    return result;
  }

  private async readDirect(): Promise<QuickWorkflowLogDocument | null> {
    const result = await this.storage.get(STORAGE_KEY);
    return isDocument(result[STORAGE_KEY]) ? result[STORAGE_KEY] : null;
  }

  start(): Promise<string> {
    const runId = this.createRunId();
    return this.serialize(async () => {
      const timestamp = this.now();
      await this.storage.set({
        [STORAGE_KEY]: { runId, startedAt: timestamp, updatedAt: timestamp, entries: [] },
      });
      return runId;
    });
  }

  append(event: QuickWorkflowLogEvent, runId?: string): Promise<void> {
    return this.serialize(async () => {
      const timestamp = this.now();
      const current = await this.readDirect();
      if (!current || (runId !== undefined && current.runId !== runId)) return;
      const entry: QuickWorkflowLogEntry = {
        timestamp,
        phase: event.phase,
        kind: event.kind,
        payload: serializable(event.payload),
        ...(event.metadata ? { metadata: serializable(event.metadata) as Record<string, unknown> } : {}),
      };
      await this.storage.set({
        [STORAGE_KEY]: {
          ...current,
          updatedAt: timestamp,
          entries: [...current.entries, entry],
        },
      });
    });
  }

  async read(): Promise<QuickWorkflowLogDocument | null> {
    await this.operations;
    return this.readDirect();
  }

  clear(): Promise<void> {
    return this.serialize(() => this.storage.remove(STORAGE_KEY));
  }
}

export async function handleQuickWorkflowLogAction(
  action: string | undefined,
  store: QuickWorkflowLogStore,
): Promise<unknown> {
  if (action === 'taskflow.quickWorkflowLog.get') return store.read();
  if (action === 'taskflow.quickWorkflowLog.clear') {
    await store.clear();
    return { cleared: true };
  }
  return undefined;
}
