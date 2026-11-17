// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  copyText,
  initializeQuickWorkflowLog,
  renderQuickWorkflowLog,
} from '../../src/sidebar/quick-workflow-log';

const documentLog = {
  runId: 'run-1',
  startedAt: '2026-11-17T16:00:00.000Z',
  updatedAt: '2026-11-17T16:00:02.000Z',
  entries: [
    {
      timestamp: '2026-11-17T16:00:01.000Z', phase: 'submission' as const, kind: 'request' as const,
      payload: { packages: [{ links: ['https://host/file.rar'] }] },
    },
    {
      timestamp: '2026-11-17T16:00:02.000Z', phase: 'create' as const, kind: 'error' as const,
      payload: { message: 'Preset missing', unrar: { password: 'visible-secret' } },
    },
  ],
};

function fixture() {
  document.body.innerHTML = `
    <p id="state"></p><div id="entries"></div>
    <button id="copy">Copia tutto</button><button id="clear">Svuota</button>`;
  return {
    state: document.querySelector<HTMLElement>('#state')!,
    entries: document.querySelector<HTMLElement>('#entries')!,
    copyButton: document.querySelector<HTMLButtonElement>('#copy')!,
    clearButton: document.querySelector<HTMLButtonElement>('#clear')!,
  };
}

describe('Quick Workflow JSON log panel', () => {
  it('copies through a temporary local field without leaving it in the page', () => {
    const execute = vi.fn(() => true);
    expect(copyText('{"secret":"clear"}', document, execute)).toBe(true);
    expect(execute).toHaveBeenCalledWith('copy');
    expect(document.querySelector('[data-quick-log-copy-source]')).toBeNull();
  });

  it('renders chronological expandable JSON entries including errors and clear-text values', () => {
    const view = fixture();
    renderQuickWorkflowLog(view, documentLog);

    const details = [...view.entries.querySelectorAll('details')];
    expect(details).toHaveLength(2);
    expect(details[0]?.querySelector('summary')?.textContent).toContain('Submission · richiesta');
    expect(details[1]?.classList.contains('error')).toBe(true);
    expect(details[1]?.querySelector('summary')?.textContent).toContain('Create · errore');
    expect(details[1]?.querySelector('pre')?.textContent).toContain('visible-secret');
    expect(view.copyButton.disabled).toBe(false);
  });

  it('copies the complete document and clears the persisted log', async () => {
    const view = fixture();
    let current = structuredClone(documentLog);
    let copied = '';
    const controller = initializeQuickWorkflowLog(view, {
      async load() { return current; },
      async clear() { current = null as never; },
      async copy(value) { copied = value; },
    });

    await controller.refresh();
    await controller.copy();
    expect(JSON.parse(copied)).toEqual(documentLog);
    await controller.clear();
    expect(view.state.textContent).toContain('Nessuna esecuzione');
    expect(view.copyButton.disabled).toBe(true);
    controller.dispose();
  });
});
