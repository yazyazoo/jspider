import { describe, expect, it } from 'vitest';
import {
  handleQuickWorkflowLogAction,
  QuickWorkflowLogStore,
  type QuickWorkflowLogStorage,
} from '../../src/background/quick-workflow-log';

function memoryStorage(): QuickWorkflowLogStorage & { values: Record<string, unknown> } {
  const values: Record<string, unknown> = {};
  return {
    values,
    async get(key) { return { [key]: values[key] }; },
    async set(items) { Object.assign(values, items); },
    async remove(key) { delete values[key]; },
  };
}

describe('QuickWorkflowLogStore', () => {
  it('replaces the previous run and appends timestamped JSON entries in order', async () => {
    const storage = memoryStorage();
    const times = [
      '2026-11-17T16:00:00.000Z',
      '2026-11-17T16:00:01.000Z',
      '2026-11-17T16:00:02.000Z',
      '2026-11-17T17:00:00.000Z',
    ];
    const store = new QuickWorkflowLogStore(storage, () => times.shift()!, () => 'run-1');

    const runId = await store.start();
    await store.append({
      phase: 'submission', kind: 'request',
      payload: { autodownload: true, packages: [{ name: 'Film', links: ['https://host/file.rar'] }] },
    }, runId);
    await store.append({
      phase: 'submission', kind: 'response',
      payload: [{ jd_id: 'jd', taskflow_id: '1234567' }],
    }, runId);

    expect(await store.read()).toEqual({
      startedAt: '2026-11-17T16:00:00.000Z',
      updatedAt: '2026-11-17T16:00:02.000Z',
      runId: 'run-1',
      entries: [
        {
          timestamp: '2026-11-17T16:00:01.000Z', phase: 'submission', kind: 'request',
          payload: { autodownload: true, packages: [{ name: 'Film', links: ['https://host/file.rar'] }] },
        },
        {
          timestamp: '2026-11-17T16:00:02.000Z', phase: 'submission', kind: 'response',
          payload: [{ jd_id: 'jd', taskflow_id: '1234567' }],
        },
      ],
    });

    await store.start();
    expect(await store.read()).toEqual({
      startedAt: '2026-11-17T17:00:00.000Z',
      updatedAt: '2026-11-17T17:00:00.000Z',
      runId: 'run-1',
      entries: [],
    });
  });

  it('rejects stale events from an older run and serializes concurrent appends', async () => {
    const storage = memoryStorage();
    const ids = ['run-old', 'run-new'];
    let tick = 0;
    const store = new QuickWorkflowLogStore(
      storage,
      () => `2026-11-17T16:00:0${tick++}.000Z`,
      () => ids.shift()!,
    );
    const oldRun = await store.start();
    const newRun = await store.start();

    await Promise.all([
      store.append({ phase: 'submission', kind: 'response', payload: { old: true } }, oldRun),
      store.append({ phase: 'submission', kind: 'request', payload: { first: true } }, newRun),
      store.append({ phase: 'submission', kind: 'response', payload: { second: true } }, newRun),
    ]);

    expect(await store.read()).toMatchObject({
      runId: 'run-new',
      entries: [
        { payload: { first: true } },
        { payload: { second: true } },
      ],
    });
  });

  it('turns circular and bigint values into storable JSON without failing the workflow log', async () => {
    const storage = memoryStorage();
    const store = new QuickWorkflowLogStore(storage, () => '2026-11-17T16:00:00.000Z');
    const payload: Record<string, unknown> = { count: 3n };
    payload.self = payload;

    await store.start();
    await store.append({ phase: 'create', kind: 'error', payload });

    expect((await store.read())?.entries[0]?.payload).toEqual({
      count: '3', self: '[Circular]',
    });
  });

  it('serves get and clear actions without exposing another storage key', async () => {
    const storage = memoryStorage();
    const store = new QuickWorkflowLogStore(storage, () => '2026-11-17T16:00:00.000Z');
    await store.start();

    await expect(handleQuickWorkflowLogAction('taskflow.quickWorkflowLog.get', store))
      .resolves.toMatchObject({ entries: [] });
    await expect(handleQuickWorkflowLogAction('taskflow.quickWorkflowLog.clear', store))
      .resolves.toEqual({ cleared: true });
    await expect(store.read()).resolves.toBeNull();
    await expect(handleQuickWorkflowLogAction('unknown', store)).resolves.toBeUndefined();
  });
});
