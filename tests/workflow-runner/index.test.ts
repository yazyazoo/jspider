// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JOB_PREFIX } from '../../src/workflow-runner/jobs';

const execute = vi.hoisted(() => vi.fn());
vi.mock('../../src/background/application', () => ({
  handle: execute,
  serializeError: (reason: Error) => ({ message: reason.message }),
}));

let values: Record<string, unknown>;
let remove: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  execute.mockReset();
  document.body.innerHTML = '<p id="runner-state"></p>';
  values = { [JOB_PREFIX + 'one']: {
    id: 'one', state: 'pending', request: { action: 'taskflow.quickWorkflow' },
  } };
  vi.stubGlobal('location', { hash: '#one' });
  vi.stubGlobal('navigator', { locks: { request: (_name: string, callback: () => Promise<unknown>) => callback() } });
  remove = vi.fn(async () => {
    expect(values[JOB_PREFIX + 'one']).toMatchObject({ state: 'succeeded' });
  });
  vi.stubGlobal('chrome', {
    storage: { local: {
      async get(key: string) { return { [key]: values[key] }; },
      async set(items: Record<string, unknown>) { Object.assign(values, structuredClone(items)); },
    } },
    tabs: { getCurrent: vi.fn(async () => ({ id: 7 })), remove },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('workflow runner automatic closing', () => {
  it('closes its own tab after Create and Start succeed and the result is saved', async () => {
    execute.mockResolvedValue({ createdWorkflow: { id: 'workflow' }, startedWorkflow: { id: 'workflow' }, startError: null });
    await import('../../src/workflow-runner/index');
    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith(7));
  });

  it('also closes after a successful package-only operation', async () => {
    execute.mockResolvedValue({ taskflowIds: ['package'], outcomes: [] });
    await import('../../src/workflow-runner/index');
    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith(7));
  });

  it('keeps the tab open when Start fails after Create', async () => {
    execute.mockResolvedValue({ createdWorkflow: { id: 'workflow' }, startError: new Error('start failed') });
    await import('../../src/workflow-runner/index');
    await vi.waitFor(() => expect(document.body.textContent).toContain('Start non riuscito'));
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps the tab open for submission or Create errors', async () => {
    execute.mockRejectedValue(new Error('submission failed'));
    await import('../../src/workflow-runner/index');
    await vi.waitFor(() => expect(document.body.textContent).toContain('submission failed'));
    expect(remove).not.toHaveBeenCalled();
  });
});
