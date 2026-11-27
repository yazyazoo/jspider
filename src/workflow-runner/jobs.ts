export const JOB_PREFIX = 'jspider.workflowJob.';
export interface WorkflowJob {
  id: string;
  state: 'pending' | 'running' | 'succeeded' | 'failed';
  request: Record<string, unknown>;
  result?: unknown;
  error?: Record<string, unknown>;
}
export interface JobStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

// The caller holds a Web Lock. Never replay a started job: its links may
// already have reached JD even after the page or browser was closed.
export async function executeJob(
  id: string, storage: JobStorage,
  execute: (request: Record<string, unknown>) => Promise<unknown>,
  serializeError: (reason: unknown) => Record<string, unknown>,
): Promise<WorkflowJob> {
  const key = JOB_PREFIX + id;
  const stored = (await storage.get(key))[key] as WorkflowJob | undefined;
  if (!stored || stored.id !== id) throw new Error('Esecuzione JSpider non trovata.');
  if (stored.state !== 'pending') return stored;
  const running: WorkflowJob = { ...stored, state: 'running' };
  await storage.set({ [key]: running });
  let completed: WorkflowJob;
  try {
    const result = await execute(stored.request);
    const serializable: unknown = JSON.parse(JSON.stringify(result, (_key, value: unknown) =>
      value instanceof Error ? serializeError(value) : value));
    completed = { ...running, request: {}, state: 'succeeded', result: serializable };
  } catch (reason) {
    completed = { ...running, state: 'failed', error: serializeError(reason) };
  }
  await storage.set({ [key]: completed });
  return completed;
}
