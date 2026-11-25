import { describe, expect, it } from 'vitest';
import {
  handleQuickWorkflowLogAction,
  QuickWorkflowLogStore,
  type QuickWorkflowLogDocument,
  type QuickWorkflowLogStorage,
} from '../../src/background/quick-workflow-log';
import { createWorkflowLogFilename } from '../../src/background/log-directory';
import type { FollowSeasonLogContext } from '../../src/domain/follow-season';

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
  it('uses the indexed Follow filename only when a Follow context is supplied', async () => {
    const storage = memoryStorage();
    const follow: FollowSeasonLogContext = {
      mediaKind: 'tv', tmdbId: 12345, season: 10,
      hosts: ['terabytez.org'], title: 'MasterChef',
    };
    const store = new QuickWorkflowLogStore(
      storage, () => '2026-11-23T13:32:11.004Z', () => 'run-follow',
    );

    await store.start('MasterChef S10', follow);

    expect(await store.read()).toMatchObject({
      fileName: expect.stringMatching(/_follow_tmdb-tv-12345_host-terabytez_MasterChef_S10\.json$/),
    });
  });

  it('replaces the previous run and appends timestamped JSON entries in order', async () => {
    const storage = memoryStorage();
    const times = [
      '2026-11-17T16:00:00.000Z',
      '2026-11-17T16:00:01.000Z',
      '2026-11-17T16:00:02.000Z',
      '2026-11-17T17:00:00.000Z',
    ];
    const written: unknown[] = [];
    const store = new QuickWorkflowLogStore(
      storage,
      () => times.shift()!,
      () => 'run-1',
      { async write(document) { written.push(structuredClone(document)); } },
    );

    const runId = await store.start('Film / Test');
    await store.append({
      phase: 'submission', kind: 'request',
      payload: { autodownload: true, packages: [{ name: 'Film', links: ['https://host/file.rar'] }] },
    }, runId);
    await store.flushHistory();
    await store.append({
      phase: 'submission', kind: 'response',
      payload: [{ jd_id: 'jd', taskflow_id: '1234567' }],
    }, runId);
    await store.flushHistory();

    expect(await store.read()).toEqual({
      workflowName: 'Film / Test',
      fileName: createWorkflowLogFilename('Film / Test', '2026-11-17T16:00:00.000Z'),
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
    expect(written).toHaveLength(3);
    expect(written.at(-1)).toEqual(await store.read());

    await store.start('Secondo film');
    expect(await store.read()).toEqual({
      workflowName: 'Secondo film',
      fileName: createWorkflowLogFilename('Secondo film', '2026-11-17T17:00:00.000Z'),
      startedAt: '2026-11-17T17:00:00.000Z',
      updatedAt: '2026-11-17T17:00:00.000Z',
      runId: 'run-1',
      entries: [],
    });
  });

  it('keeps storage logging operational when file history cannot be written', async () => {
    const storage = memoryStorage();
    const store = new QuickWorkflowLogStore(
      storage,
      () => '2026-11-17T16:00:00.000Z',
      () => 'run-1',
      { async write() { throw new Error('folder unavailable'); } },
    );

    const runId = await store.start('Film');
    await store.append({ phase: 'submission', kind: 'error', payload: { message: 'failed' } }, runId);

    await expect(store.read()).resolves.toMatchObject({
      workflowName: 'Film', entries: [{ payload: { message: 'failed' } }],
    });
  });

  it('does not block Quick Workflow when a filesystem write never settles', async () => {
    const storage = memoryStorage();
    const store = new QuickWorkflowLogStore(
      storage,
      () => '2026-11-17T16:00:00.000Z',
      () => 'run-1',
      { write: () => new Promise(() => undefined) },
    );

    const outcome = await Promise.race([
      store.start('Film').then(() => 'started'),
      new Promise<string>((resolve) => setTimeout(() => resolve('blocked'), 25)),
    ]);

    expect(outcome).toBe('started');
  });

  it('rejects stale events from an older run and serializes concurrent appends', async () => {
    const storage = memoryStorage();
    const history: Array<{ runId: string; entries: unknown[] }> = [];
    const ids = ['run-old', 'run-new'];
    let tick = 0;
    const store = new QuickWorkflowLogStore(
      storage,
      () => `2026-11-17T16:00:0${tick++}.000Z`,
      () => ids.shift()!,
      { async write(document) { history.push(structuredClone(document)); } },
    );
    const oldRun = await store.start();
    const newRun = await store.start();

    await Promise.all([
      store.append({ phase: 'submission', kind: 'response', payload: { old: true } }, oldRun),
      store.append({ phase: 'submission', kind: 'request', payload: { first: true } }, newRun),
      store.append({ phase: 'submission', kind: 'response', payload: { second: true } }, newRun),
    ]);
    await store.flushHistory();

    expect(await store.read()).toMatchObject({
      runId: 'run-new',
      entries: [
        { payload: { first: true } },
        { payload: { second: true } },
      ],
    });
    expect(history.filter((document) => document.runId === 'run-old').at(-1)?.entries)
      .toEqual([expect.objectContaining({ payload: { old: true } })]);
  });

  it('continues the historical file after the latest sidebar log is cleared', async () => {
    const storage = memoryStorage();
    const history: QuickWorkflowLogDocument[] = [];
    const store = new QuickWorkflowLogStore(
      storage,
      () => '2026-11-17T16:00:00.000Z',
      () => 'run-1',
      { async write(document) { history.push(structuredClone(document)); } },
    );
    const runId = await store.start('Film');

    await store.clear();
    await store.append({ phase: 'submission', kind: 'response', payload: { accepted: true } }, runId);
    await store.flushHistory();

    await expect(store.read()).resolves.toBeNull();
    expect(history.at(-1)?.entries).toEqual([
      expect.objectContaining({ payload: { accepted: true } }),
    ]);
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
