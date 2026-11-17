import { describe, expect, it } from 'vitest';
import { TaskFlowClient } from '../../src/background/taskflow-client';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

describe('TaskFlowClient', () => {
  it('discovers the enabled JDownloader integration instead of hard-coding an ID', async () => {
    const requests: Request[] = [];
    const client = new TaskFlowClient('https://taskflow.example/', 'private-token', async (request) => {
      requests.push(request);
      return json([
        { id: '1111111', type: 'filesystem', enabled: true },
        { id: '2510505', type: 'jdownloader', enabled: true },
      ]);
    });

    await expect(client.discoverJDownloaderIntegration()).resolves.toBe('2510505');
    expect(requests[0]?.url).toBe('https://taskflow.example/api/v1/integrations');
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer private-token');
  });

  it('sends the exact submission body once and never retries a lost response', async () => {
    let calls = 0;
    const client = new TaskFlowClient('https://taskflow.example', 'private-token', async () => {
      calls += 1;
      throw new Error('connection lost private-token');
    });
    await expect(client.submitPackages('2510505', {
      autodownload: true,
      packages: [{ name: 'Film', links: ['https://terabytez.org/a/film.rar'] }],
    })).rejects.toThrow('connection lost [redacted]');
    expect(calls).toBe(1);
  });

  it('keeps Create and Start as separate API calls', async () => {
    const requests: Request[] = [];
    const client = new TaskFlowClient('https://taskflow.example', 'token', async (request) => {
      requests.push(request);
      return request.url.endsWith('/start')
        ? json({ id: '7654321', status: 'waiting_packages' })
        : json({ id: '7654321', status: 'created' }, 201);
    });
    await client.createWorkflow({ workflow_name: 'Film', packages: ['1234567'], tasks: ['unrar'] });
    await client.startWorkflow('7654321');
    expect(requests.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toEqual([
      'POST /api/v1/workflows', 'POST /api/v1/workflows/7654321/start',
    ]);
  });

  it('surfaces the safe TaskFlow error envelope without including the token', async () => {
    const response = {
      error: {
        code: 'api.validation_error', message: 'Request validation failed',
        details: { preset: 'missing' },
      },
    };
    const client = new TaskFlowClient('https://taskflow.example', 'private-token', async () => json(response, 422));
    await expect(client.createWorkflow({})).rejects.toMatchObject({
      message: 'Request validation failed', code: 'api.validation_error', status: 422,
      response,
    });
  });

  it('attaches malformed successful Create JSON to the validation error', async () => {
    const response = { status: 'created', warning: 'id missing' };
    const client = new TaskFlowClient('https://taskflow.example', 'token', async () => json(response, 201));
    await expect(client.createWorkflow({})).rejects.toMatchObject({
      message: 'Risposta Create di TaskFlow non valida.', response,
    });
  });
});

