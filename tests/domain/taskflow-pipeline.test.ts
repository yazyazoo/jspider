import { describe, expect, it } from 'vitest';
import {
  loadTaskFlowPackages,
  runQuickWorkflow,
  SubmissionBatchError,
} from '../../src/domain/taskflow-pipeline';

const selected = [{
  key: '4k', packageName: 'Film — 4K', password: 'secret',
  links: ['https://terabytez.org/a/film.part01.rar'],
}];

const draft = {
  workflowName: 'Film 2026', preset: 'movie-standard',
  metadata: { mode: 'validated' as const, id: 42, mediaKind: 'movie' as const },
  password: 'secret',
  cleanupOnSuccess: true,
};

describe('runQuickWorkflow', () => {
  it('emits the exact request and response JSON for every successful phase', async () => {
    const events: Array<{ phase: string; kind: string; payload: unknown }> = [];
    const api = {
      async submitPackages() {
        return [{ name: 'Film — 4K', jd_id: 'opaque', taskflow_id: '1234567' }];
      },
      async createWorkflow() { return { id: '7654321', status: 'created' }; },
      async startWorkflow(id: string) { return { id, status: 'waiting_packages' }; },
    };

    await runQuickWorkflow({
      api, integrationId: '2510505', variants: selected,
      hosts: ['terabytez.org'], autodownload: true, workflow: draft,
      onLogEvent(event) { events.push(event); },
    });

    expect(events).toEqual([
      {
        phase: 'submission', kind: 'request',
        payload: {
          autodownload: true,
          packages: [{ name: 'Film — 4K', links: ['https://terabytez.org/a/film.part01.rar'] }],
        },
      },
      {
        phase: 'submission', kind: 'response',
        payload: [{ name: 'Film — 4K', jd_id: 'opaque', taskflow_id: '1234567' }],
      },
      {
        phase: 'create', kind: 'request',
        payload: {
          workflow_name: 'Film_2026', packages: ['1234567'], preset: 'movie-standard',
          media_kind: 'movie', cleanup_on_success: true, tmdb: { tmdb_id: 42 },
          unrar: { password: 'secret' },
        },
      },
      {
        phase: 'create', kind: 'response',
        payload: { id: '7654321', status: 'created' },
      },
      {
        phase: 'start', kind: 'request', payload: null,
        metadata: { workflowId: '7654321' },
      },
      {
        phase: 'start', kind: 'response',
        payload: { id: '7654321', status: 'waiting_packages' },
      },
    ]);
  });

  it('emits the failing phase error without letting a logger failure break the workflow', async () => {
    const events: Array<{ phase: string; kind: string; payload: unknown }> = [];
    const api = {
      async submitPackages() {
        return [{ name: 'Film — 4K', jd_id: 'opaque', taskflow_id: '1234567' }];
      },
      async createWorkflow() {
        const error = Object.assign(new Error('Preset missing'), {
          status: 422, code: 'preset.missing',
          response: { error: { code: 'preset.missing', details: { preset: 'movie-standard' } } },
        });
        throw error;
      },
      async startWorkflow() { return { id: 'never' }; },
    };

    await expect(runQuickWorkflow({
      api, integrationId: '2510505', variants: selected,
      hosts: ['terabytez.org'], autodownload: true, workflow: draft,
      onLogEvent(event) {
        events.push(event);
        if (event.phase === 'submission' && event.kind === 'request') throw new Error('storage offline');
      },
    })).rejects.toThrow('Preset missing');

    expect(events.at(-1)).toEqual({
      phase: 'create', kind: 'error',
      payload: {
        name: 'Error', message: 'Preset missing', status: 422, code: 'preset.missing',
        response: { error: { code: 'preset.missing', details: { preset: 'movie-standard' } } },
      },
    });
  });

  it('logs Create preparation failures after a successful submission response', async () => {
    const events: Array<{ phase: string; kind: string; payload: unknown }> = [];
    const api = {
      async submitPackages() {
        return [{ name: 'Film — 4K', jd_id: 'opaque', taskflow_id: ' padded-id ' }];
      },
      async createWorkflow() { return { id: 'never' }; },
      async startWorkflow() { return { id: 'never' }; },
    };

    await expect(runQuickWorkflow({
      api, integrationId: '2510505', variants: selected,
      hosts: ['terabytez.org'], autodownload: true, workflow: draft,
      onLogEvent(event) { events.push(event); },
    })).rejects.toThrow('ID pacchetto TaskFlow');

    expect(events.at(-1)).toMatchObject({
      phase: 'create', kind: 'error',
      payload: { message: 'Gli ID pacchetto TaskFlow devono essere stringhe opache non vuote e senza caratteri di controllo.' },
    });
  });

  it('runs submission, one Create and a separate Start in order', async () => {
    const calls: string[] = [];
    let submittedAutodownload: boolean | undefined;
    let createdPayload: Record<string, unknown> | undefined;
    const api = {
      async submitPackages(_integrationId: string, request: { autodownload: boolean }) {
        submittedAutodownload = request.autodownload;
        calls.push('submission');
        return [{ name: 'Film — 4K', jd_id: 'opaque', taskflow_id: '1234567' }];
      },
      async createWorkflow(payload: Record<string, unknown>) {
        createdPayload = payload;
        calls.push(`create:${(payload.packages as string[]).join(',')}`);
        return { id: '7654321', status: 'created' };
      },
      async startWorkflow(id: string) {
        calls.push(`start:${id}`);
        return { id, status: 'waiting_packages' };
      },
    };

    const result = await runQuickWorkflow({
      api, integrationId: '2510505', variants: selected,
      hosts: ['terabytez.org'], autodownload: true, workflow: draft,
    });

    expect(calls).toEqual(['submission', 'create:1234567', 'start:7654321']);
    expect(submittedAutodownload).toBe(true);
    expect(createdPayload).toMatchObject({ cleanup_on_success: true });
    expect(result.startedWorkflow).toEqual({ id: '7654321', status: 'waiting_packages' });
    expect(result.startError).toBeNull();
  });

  it('stops after a submission-only LinkGrabber result when autodownload is disabled', async () => {
    const calls: string[] = [];
    const api = {
      async submitPackages(_integrationId: string, request: { autodownload: boolean }) {
        calls.push(`submission:${String(request.autodownload)}`);
        return [{ name: 'Film — 4K', jd_id: 'opaque', taskflow_id: null }];
      },
      async createWorkflow() { calls.push('create'); return { id: 'never' }; },
      async startWorkflow() { calls.push('start'); return { id: 'never' }; },
    };

    const result = await runQuickWorkflow({
      api, integrationId: '2510505', variants: selected,
      hosts: ['terabytez.org'], autodownload: false,
    });

    expect(calls).toEqual(['submission:false']);
    expect(result).toMatchObject({
      submissionOnly: true,
      submission: { taskflowIds: [], failures: [] },
      createdWorkflow: null,
      startedWorkflow: null,
      startError: null,
    });
  });

  it('preserves positional failures and never creates an incomplete workflow', async () => {
    let createCalls = 0;
    const api = {
      async submitPackages() { return [{ name: 'Film — 4K', error: 'JD unavailable' }]; },
      async createWorkflow() { createCalls += 1; return { id: 'never' }; },
      async startWorkflow() { return { id: 'never' }; },
    };

    await expect(runQuickWorkflow({
      api, integrationId: '2510505', variants: selected,
      hosts: ['terabytez.org'], autodownload: true, workflow: draft,
    })).rejects.toMatchObject({
      name: 'SubmissionBatchError', analysis: { failures: [{ inputName: 'Film — 4K' }] },
    });
    expect(createCalls).toBe(0);
  });

  it('returns the created workflow when Start fails so only Start can be retried', async () => {
    let submissionCalls = 0;
    const api = {
      async submitPackages() {
        submissionCalls += 1;
        return [{ name: 'Film — 4K', jd_id: 'opaque', taskflow_id: '1234567' }];
      },
      async createWorkflow() { return { id: '7654321', status: 'created' }; },
      async startWorkflow() { throw new Error('queue offline'); },
    };

    const result = await runQuickWorkflow({
      api, integrationId: '2510505', variants: selected,
      hosts: ['terabytez.org'], autodownload: true, workflow: draft,
    });
    expect(result.createdWorkflow).toEqual({ id: '7654321', status: 'created' });
    expect(result.startedWorkflow).toBeNull();
    expect(result.startError?.message).toBe('queue offline');
    expect(submissionCalls).toBe(1);
  });
});

describe('loadTaskFlowPackages', () => {
  it('loads persistent packages without calling Create or Start', async () => {
    const calls: string[] = [];
    const api = {
      async submitPackages(_integrationId: string, request: { autodownload: boolean }) {
        calls.push(`submission:${String(request.autodownload)}`);
        return [{ name: 'Film — 4K', jd_id: 'opaque', taskflow_id: '1234567' }];
      },
      async createWorkflow() { calls.push('create'); return { id: 'never' }; },
      async startWorkflow() { calls.push('start'); return { id: 'never' }; },
    };

    const result = await loadTaskFlowPackages({
      api, integrationId: '2510505', variants: selected, hosts: ['terabytez.org'],
    });

    expect(calls).toEqual(['submission:true']);
    expect(result.taskflowIds).toEqual(['1234567']);
  });

  it('does not retry or create when any package result is ambiguous', async () => {
    let submissions = 0;
    let creates = 0;
    const api = {
      async submitPackages() {
        submissions += 1;
        return [{ name: 'Film — 4K', error: 'JDownloader submission could not be confirmed' }];
      },
      async createWorkflow() { creates += 1; return { id: 'never' }; },
      async startWorkflow() { return { id: 'never' }; },
    };

    await expect(loadTaskFlowPackages({
      api, integrationId: '2510505', variants: selected, hosts: ['terabytez.org'],
    })).rejects.toBeInstanceOf(SubmissionBatchError);
    expect({ submissions, creates }).toEqual({ submissions: 1, creates: 0 });
  });
});

