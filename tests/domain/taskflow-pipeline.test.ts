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

