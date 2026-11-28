import { JOB_PREFIX, type WorkflowJob } from './jobs';

export function runWorkflowOperation<T>(
  protectedExecution: boolean,
  action: string,
  data: Record<string, unknown>,
  standard: (action: string, data: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  return protectedExecution ? runInWorkflowTab<T>(action, data) : standard(action, data);
}

export async function runInWorkflowTab<T>(action: string, data: Record<string, unknown>): Promise<T> {
  const id = crypto.randomUUID();
  const key = JOB_PREFIX + id;
  const job: WorkflowJob = {
    id, state: 'pending', request: { target: 'background', action, ...data },
  };
  await chrome.storage.local.set({ [key]: job });
  const tab = await chrome.tabs.create({
    url: chrome.runtime.getURL(`workflow-runner.html#${id}`), active: false,
  });
  if (tab.id !== undefined) await chrome.tabs.update(tab.id, { autoDiscardable: false });
  while (true) {
    const current = (await chrome.storage.local.get(key))[key] as WorkflowJob | undefined;
    if (current?.state === 'succeeded') return current.result as T;
    if (current?.state === 'failed') {
      throw Object.assign(new Error(String(current.error?.message ?? 'Quick Workflow non riuscito.')), current.error);
    }
    if (tab.id === undefined) throw new Error('Scheda di esecuzione JSpider non disponibile.');
    try { await chrome.tabs.get(tab.id); }
    catch {
      // Completion can be persisted and the runner closed between this poll's
      // first storage read and tabs.get. Check again before reporting an abort.
      const completed = (await chrome.storage.local.get(key))[key] as WorkflowJob | undefined;
      if (completed?.state === 'succeeded') return completed.result as T;
      if (completed?.state === 'failed') {
        throw Object.assign(new Error(String(completed.error?.message ?? 'Quick Workflow non riuscito.')), completed.error);
      }
      throw new Error('Scheda di esecuzione chiusa. TaskFlow potrebbe avere già ricevuto i package: verifica nella WebUI prima di riprovare.');
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
