// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

const modulePath = '../../src/sidebar/webui-version';

async function loadModule() {
  return import(modulePath).catch(() => ({} as Record<string, unknown>));
}

const embedded = {
  source: 'https://taskflow.redprimrose.mov/ui/taskflow-ui.es.js',
  etag: '"old"',
  lastModified: null,
  sha256: '9289140b1ac28dbda1437b283e6ca608e33186654e7d3a995da268c35906cd4c',
  syncedAt: '2026-11-14T00:00:00.000Z',
};

describe('TaskFlow WebUI version check', () => {
  it('reports the embedded component as current when hashes match', async () => {
    const { checkTaskFlowWebUiVersion } = await loadModule() as {
      checkTaskFlowWebUiVersion?: Function;
    };
    expect(checkTaskFlowWebUiVersion).toBeTypeOf('function');
    const result = await checkTaskFlowWebUiVersion!(embedded, async () => new Response('embedded'));
    expect(result).toMatchObject({ state: 'current', liveSha256: embedded.sha256 });
  });

  it('detects an update even when the response has no Content-Length', async () => {
    const { checkTaskFlowWebUiVersion } = await loadModule() as {
      checkTaskFlowWebUiVersion?: Function;
    };
    expect(checkTaskFlowWebUiVersion).toBeTypeOf('function');
    const response = new Response('live revision', { headers: { ETag: '"new"' } });
    expect(response.headers.has('content-length')).toBe(false);
    const result = await checkTaskFlowWebUiVersion!(embedded, async () => response);
    expect(result).toMatchObject({ state: 'update-available', etag: '"new"' });
  });

  it('does not turn a network error into an up-to-date result', async () => {
    const { checkTaskFlowWebUiVersion } = await loadModule() as {
      checkTaskFlowWebUiVersion?: Function;
    };
    expect(checkTaskFlowWebUiVersion).toBeTypeOf('function');
    await expect(checkTaskFlowWebUiVersion!(embedded, async () => {
      throw new Error('offline');
    })).rejects.toThrow('offline');
  });

  it('renders update instructions and restores the check button after completion', async () => {
    const { initializeWebUiVersionCheck } = await loadModule() as {
      initializeWebUiVersionCheck?: Function;
    };
    expect(initializeWebUiVersionCheck).toBeTypeOf('function');
    document.body.innerHTML = '<button id="check">Controlla</button><p id="state"></p>';
    const button = document.querySelector<HTMLButtonElement>('#check')!;
    const state = document.querySelector<HTMLElement>('#state')!;
    const controller = initializeWebUiVersionCheck!({ button, state }, {
      loadEmbedded: async () => embedded,
      check: async () => ({ state: 'update-available', liveSha256: 'b'.repeat(64), etag: '"new"' }),
    });

    await controller.refresh();

    expect(button.disabled).toBe(false);
    expect(state.textContent).toContain('Aggiornamento disponibile');
    expect(state.textContent).toContain('Aggiorna-WebUI.cmd');
    expect(state.textContent).toContain('Aggiorna-WebUI.command');
    controller.dispose();
  });
});
