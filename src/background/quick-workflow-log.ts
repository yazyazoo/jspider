import type { QuickWorkflowLogEvent } from '../domain/taskflow-pipeline';
import { createWorkflowLogFilename } from './log-directory';
import {
  createFollowLogFilename,
  type FollowSeasonLogContext,
} from '../domain/follow-season';

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
  workflowName: string;
  fileName: string;
  startedAt: string;
  updatedAt: string;
  entries: QuickWorkflowLogEntry[];
}

export interface QuickWorkflowLogHistory {
  write(document: QuickWorkflowLogDocument): Promise<unknown>;
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
    && typeof candidate.workflowName === 'string'
    && typeof candidate.fileName === 'string'
    && Array.isArray(candidate.entries);
}

export class QuickWorkflowLogStore {
  private operations: Promise<void> = Promise.resolve();
  private historyOperations: Promise<void> = Promise.resolve();
  private readonly runs = new Map<string, QuickWorkflowLogDocument>();
  private latestRunId: string | null = null;

  constructor(
    private readonly storage: QuickWorkflowLogStorage,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly createRunId: () => string = () => crypto.randomUUID(),
    private readonly history?: QuickWorkflowLogHistory,
  ) {}

  private mirror(document: QuickWorkflowLogDocument): void {
    if (!this.history) return;
    this.historyOperations = this.historyOperations
      .then(() => this.history!.write(document))
      .then(() => undefined)
      .catch(() => undefined);
  }

  async flushHistory(maxWaitMs = 500): Promise<void> {
    if (!this.history) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, maxWaitMs);
      void this.historyOperations.finally(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation, operation);
    this.operations = result.then(() => undefined, () => undefined);
    return result;
  }

  private async readDirect(): Promise<QuickWorkflowLogDocument | null> {
    const result = await this.storage.get(STORAGE_KEY);
    return isDocument(result[STORAGE_KEY]) ? result[STORAGE_KEY] : null;
  }

  start(workflowName = 'Quick Workflow', follow?: FollowSeasonLogContext): Promise<string> {
    const runId = this.createRunId();
    return this.serialize(async () => {
      const timestamp = this.now();
      const document: QuickWorkflowLogDocument = {
        runId,
        workflowName,
        fileName: follow
          ? createFollowLogFilename(follow, timestamp)
          : createWorkflowLogFilename(workflowName, timestamp),
        startedAt: timestamp,
        updatedAt: timestamp,
        entries: [],
      };
      this.runs.set(runId, document);
      this.latestRunId = runId;
      try { await this.storage.set({ [STORAGE_KEY]: document }); }
      catch { /* File history can continue even when extension storage is unavailable. */ }
      this.mirror(document);
      return runId;
    });
  }

  append(event: QuickWorkflowLogEvent, runId?: string): Promise<void> {
    return this.serialize(async () => {
      const timestamp = this.now();
      const targetRunId = runId ?? this.latestRunId;
      if (!targetRunId) return;
      const current = this.runs.get(targetRunId)
        ?? (this.latestRunId === targetRunId ? await this.readDirect() : null);
      if (!current || current.runId !== targetRunId) return;
      const entry: QuickWorkflowLogEntry = {
        timestamp,
        phase: event.phase,
        kind: event.kind,
        payload: serializable(event.payload),
        ...(event.metadata ? { metadata: serializable(event.metadata) as Record<string, unknown> } : {}),
      };
      const document: QuickWorkflowLogDocument = {
        ...current,
        updatedAt: timestamp,
        entries: [...current.entries, entry],
      };
      this.runs.set(targetRunId, document);
      if (this.latestRunId === targetRunId) {
        try { await this.storage.set({ [STORAGE_KEY]: document }); }
        catch { /* File history remains available independently. */ }
      }
      this.mirror(document);
    });
  }

  async read(): Promise<QuickWorkflowLogDocument | null> {
    await this.operations;
    return this.readDirect();
  }

  clear(): Promise<void> {
    return this.serialize(async () => {
      this.latestRunId = null;
      await this.storage.remove(STORAGE_KEY);
    });
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
