import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeJob, JOB_PREFIX, type WorkflowJob } from '../../src/workflow-runner/jobs';

afterEach(() => vi.useRealTimers());

function fixture(state: WorkflowJob['state'] = 'pending') {
  const key = JOB_PREFIX + 'one';
  const values: Record<string, unknown> = {
    [key]: { id: 'one', state, request: { action: 'taskflow.quickWorkflow' } },
  };
  return {
    values, key,
    storage: {
      async get(key: string) { return { [key]: values[key] }; },
      async set(items: Record<string, unknown>) { Object.assign(values, structuredClone(items)); },
    },
  };
}

describe('page-owned workflow execution', () => {
  it('waits longer than the worker lifetime and persists completion without a message channel', async () => {
    vi.useFakeTimers();
    const { key, values, storage } = fixture();
    const execute = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 12 * 60 * 1000));
      return { createdWorkflow: { id: 'workflow' } };
    });
    const result = executeJob('one', storage, execute, () => ({}));
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    expect(values[key]).toMatchObject({ state: 'running' });
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    await expect(result).resolves.toMatchObject({ state: 'succeeded', result: { createdWorkflow: { id: 'workflow' } } });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each(['running', 'succeeded', 'failed'] as const)('never resubmits a %s job on page reload', async (state) => {
    const { storage } = fixture(state);
    const execute = vi.fn();
    await expect(executeJob('one', storage, execute, () => ({}))).resolves.toMatchObject({ state });
    expect(execute).not.toHaveBeenCalled();
  });

  it('stores errors for the sidebar and does not retry the submission', async () => {
    const { storage, values, key } = fixture();
    const execute = vi.fn(async () => { throw new Error('submission uncertain'); });
    await executeJob('one', storage, execute, reason => ({ message: (reason as Error).message }));
    expect(values[key]).toMatchObject({ state: 'failed', error: { message: 'submission uncertain' } });
    await executeJob('one', storage, execute, () => ({}));
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
