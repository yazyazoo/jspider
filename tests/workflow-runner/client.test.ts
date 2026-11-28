import { afterEach, describe, expect, it, vi } from 'vitest';
import { runWorkflowOperation } from '../../src/workflow-runner/client';
import { JOB_PREFIX, type WorkflowJob } from '../../src/workflow-runner/jobs';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('workflow tab client', () => {
  it('reads the saved result if the runner closes between polling and checking its tab', async () => {
    const values: Record<string, WorkflowJob> = {};
    vi.stubGlobal('chrome', {
      storage: { local: {
        async get(key: string) { return { [key]: values[key] }; },
        async set(items: Record<string, WorkflowJob>) { Object.assign(values, items); },
      } },
      runtime: { getURL: (path: string) => 'chrome-extension://jspider/' + path },
      tabs: {
        create: vi.fn(async () => ({ id: 123 })),
        update: vi.fn(async () => ({})),
        get: vi.fn(async () => {
          const key = Object.keys(values)[0]!;
          values[key] = { ...values[key]!, state: 'succeeded', result: { id: 'workflow' } };
          throw new Error('tab closed after success');
        }),
      },
    });
    await expect(runWorkflowOperation(true, 'taskflow.quickWorkflow', {}, vi.fn()))
      .resolves.toEqual({ id: 'workflow' });
  });
  it('uses the original background operation when protection is disabled', async () => {
    const direct = vi.fn(async () => ({ id: 'original-flow' }));
    await expect(runWorkflowOperation(false, 'taskflow.quickWorkflow', { autodownload: true }, direct))
      .resolves.toEqual({ id: 'original-flow' });
    expect(direct).toHaveBeenCalledWith('taskflow.quickWorkflow', { autodownload: true });
  });
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
    const direct = vi.fn();
    const result = runWorkflowOperation(true, 'taskflow.quickWorkflow', { autodownload: true }, direct);
    await vi.advanceTimersByTimeAsync(12 * 60 * 1000);
    const key = Object.keys(values)[0]!;
    expect(key.startsWith(JOB_PREFIX)).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(123, { autoDiscardable: false });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(direct).not.toHaveBeenCalled();
    values[key] = { ...values[key]!, state: 'succeeded', result: { id: 'workflow' } };
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toEqual({ id: 'workflow' });
  });
});
