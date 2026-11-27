// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { initializeLogDirectoryPicker } from '../../src/log-directory/controller';

function fixture() {
  document.body.innerHTML = '<input id="path"><button id="choose">Scegli</button><p id="state"></p>';
  return {
    pathInput: document.querySelector<HTMLInputElement>('#path')!,
    chooseButton: document.querySelector<HTMLButtonElement>('#choose')!,
    state: document.querySelector<HTMLElement>('#state')!,
  };
}

describe('top-level log directory picker', () => {
  it('authorizes the configured log folder directly without selecting the project root', async () => {
    const view = fixture();
    view.pathInput.value = 'C:\\work\\JSpider\\log';
    const saved: unknown[] = [];
    const markers: Record<string, unknown>[] = [];
    const logHandle = { name: 'log' };
    const calls: string[] = [];
    const controller = initializeLogDirectoryPicker(view, {
      async pickLog() { calls.push('pick'); return logHandle as never; },
      async saveLog(value) { calls.push('save'); saved.push(value); },
      async publish(items) { calls.push('publish'); markers.push(items); },
    });

    await controller.choose();

    expect(calls).toEqual(['pick', 'save', 'publish']);
    expect(saved).toEqual([logHandle]);
    expect(markers).toEqual([{
      'jspider.logDirectoryName': 'log',
      'jspider.logDirectoryPath': 'C:\\work\\JSpider\\log',
      'jspider.logDirectoryDraft': 'C:\\work\\JSpider\\log',
      'jspider.logDirectoryRevision': expect.any(Number),
    }]);
    expect(view.state.textContent).toBe(
      'CONFIG E CHROMIUM ALLINEATI · C:\\work\\JSpider\\log. Puoi chiudere questa scheda.',
    );
  });

  it('reports a cancelled selection without storing anything', async () => {
    const view = fixture();
    view.pathInput.value = 'C:\\work\\JSpider\\log';
    const controller = initializeLogDirectoryPicker(view, {
      async pickLog() { throw new DOMException('cancelled', 'AbortError'); },
      async saveLog() { throw new Error('must not save'); },
      async publish() { throw new Error('must not publish'); },
    });

    await controller.choose();

    expect(view.state.textContent).toBe(
      'Selezione annullata. JSpider non ha modificato la configurazione.',
    );
  });

  it('does not open the picker without a complete path', async () => {
    const view = fixture();
    let picked = false;
    const controller = initializeLogDirectoryPicker(view, {
      async pickLog() { picked = true; return {} as never; },
      async saveLog() { throw new Error('must not save'); },
      async publish() { throw new Error('must not publish'); },
    });

    await controller.choose();

    expect(picked).toBe(false);
    expect(view.state.textContent).toContain('percorso completo');
  });
});
