import { beforeEach, describe, expect, it, vi } from 'vitest';

type MessageListener = (
  message: Record<string, unknown>,
  sender: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
) => boolean | undefined;

describe('background Quick Workflow log actions', () => {
  let listener: MessageListener | undefined;
  let values: Record<string, unknown>;
  let failLogSet: boolean;

  beforeEach(async () => {
    vi.resetModules();
    values = {};
    failLogSet = false;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    vi.stubGlobal('chrome', {
      action: { onClicked: { addListener: vi.fn() } },
      tabs: { sendMessage: vi.fn() },
      runtime: {
        getURL: (path: string) => `chrome-extension://jspider/${path}`,
        onMessage: { addListener: (candidate: MessageListener) => { listener = candidate; } },
      },
      storage: {
        local: {
          async get(key: string) { return { [key]: values[key] }; },
          async set(items: Record<string, unknown>) {
            if (failLogSet && Object.hasOwn(items, 'jspider.quickWorkflowLog')) {
              throw new Error('storage unavailable');
            }
            Object.assign(values, items);
          },
          async remove(key: string) { delete values[key]; },
        },
      },
    });
    await import('../../src/background/index');
  });

  async function send(action: string, data: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve) => {
      expect(listener?.({ target: 'background', action, ...data }, {}, resolve)).toBe(true);
    });
  }

  it('serves and clears the local log without requiring TaskFlow settings', async () => {
    await expect(send('taskflow.quickWorkflowLog.get'))
      .resolves.toEqual({ ok: true, data: null });
    await expect(send('taskflow.quickWorkflowLog.clear'))
      .resolves.toEqual({ ok: true, data: { cleared: true } });
  });

  it('continues Quick Workflow when local diagnostic storage is unavailable', async () => {
    values['jspider.settings'] = {
      taskflowBaseUrl: 'https://taskflow.example', taskflowToken: 'token',
      tmdbCredential: '', omdbApiKey: '', mdblistApiKey: '',
    };
    failLogSet = true;
    configureSuccessfulTaskFlow();

    await expect(send('taskflow.quickWorkflow', {
      variants: [{ key: '4k', packageName: 'Film', password: '', links: ['https://terabytez.org/a/film.rar'] }],
      hosts: ['terabytez.org'], autodownload: true,
      workflow: {
        workflowName: 'Film', preset: 'movie-standard',
        metadata: { mode: 'validated', id: 42, mediaKind: 'movie' },
        password: '', cleanupOnSuccess: true,
      },
    })).resolves.toMatchObject({
      ok: true,
      data: { createdWorkflow: { id: '7654321' }, startedWorkflow: { status: 'waiting_packages' } },
    });
  });

  it('names the persisted log after the Quick Workflow', async () => {
    values['jspider.settings'] = {
      taskflowBaseUrl: 'https://taskflow.example', taskflowToken: 'token',
      tmdbCredential: '', omdbApiKey: '', mdblistApiKey: '',
    };
    configureSuccessfulTaskFlow();

    await send('taskflow.quickWorkflow', {
      variants: [{ key: '4k', packageName: 'Film', password: '', links: ['https://terabytez.org/a/film.rar'] }],
      hosts: ['terabytez.org'], autodownload: true,
      workflow: {
        workflowName: 'Film', preset: 'movie-standard',
        metadata: { mode: 'validated', id: 42, mediaKind: 'movie' },
        password: '', cleanupOnSuccess: true,
      },
    });

    expect(values['jspider.quickWorkflowLog']).toMatchObject({
      workflowName: 'Film', fileName: expect.stringMatching(/^\d{4}-\d{2}-\d{2}_.*_Film\.json$/),
    });
  });
});

function configureSuccessfulTaskFlow(): void {
  vi.mocked(fetch).mockImplementation(async (request) => {
    const url = request instanceof Request ? request.url : request.toString();
    if (url.endsWith('/api/v1/integrations')) {
      return json([{ id: '2510505', type: 'jdownloader', enabled: true }]);
    }
    if (url.endsWith('/submission')) {
      return json([{ name: 'Film', jd_id: 'jd', taskflow_id: '1234567' }]);
    }
    if (url.endsWith('/start')) return json({ id: '7654321', status: 'waiting_packages' });
    if (url.endsWith('/api/v1/workflows')) return json({ id: '7654321', status: 'created' }, 201);
    return json({}, 404);
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
}
