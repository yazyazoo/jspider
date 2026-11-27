import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInWorkflowTab } from '../../src/workflow-runner/client';
import { JOB_PREFIX, type WorkflowJob } from '../../src/workflow-runner/jobs';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('workflow tab client', () => {
  it('uses short storage reads during a long execution and returns its durable result', async () => {
    vi.useFakeTimers();
    const values: Record<string, WorkflowJob> = {};
    const sendMessage = vi.fn();
    const create = vi.fn(async () => ({ id: 123 }));
    const update = vi.fn(async () => ({}));
    vi.stubGlobal('chrome', {
      storage: { local: {
        async get(key: string) { return { [key]: values[key] }; },
        async set(items: Record<string, WorkflowJob>) { Object.assign(values, items); },
      } },
      runtime: { getURL: (path: string) => 'chrome-extension://jspider/' + path, sendMessage },
      tabs: { create, update, get: vi.fn(async () => ({ id: 123 })) },
    });
    const result = runInWorkflowTab('taskflow.quickWorkflow', { autodownload: true });
    await vi.advanceTimersByTimeAsync(12 * 60 * 1000);
    const key = Object.keys(values)[0]!;
    expect(key.startsWith(JOB_PREFIX)).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(123, { autoDiscardable: false });
    expect(sendMessage).not.toHaveBeenCalled();
    values[key] = { ...values[key]!, state: 'succeeded', result: { id: 'workflow' } };
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toEqual({ id: 'workflow' });
  });
});
