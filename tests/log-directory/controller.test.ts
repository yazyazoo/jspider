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
  it('aligns both configs, stores the log handle, publishes the full path, and synchronizes settings', async () => {
    const view = fixture();
    view.pathInput.value = 'C:\\work\\JSpider-follow-season\\log';
    const saved: unknown[] = [];
    const markers: Record<string, unknown>[] = [];
    const project = { name: 'JSpider-follow-season' };
    const logHandle = { name: 'log' };
    const calls: string[] = [];
    const controller = initializeLogDirectoryPicker(view, {
      async pickProject() { calls.push('pick'); return project as never; },
      async align(value, path) {
        calls.push('align');
        expect(value).toBe(project);
        expect(path).toBe('C:\\work\\JSpider-follow-season\\log');
        return {
          logHandle: logHandle as never,
          fullPath: path,
          updatedFiles: ['config.local.json', 'dist/config.local.json'],
        };
      },
      async saveLog(value) { calls.push('save'); saved.push(value); },
      async publish(items) { calls.push('publish'); markers.push(items); },
      async synchronizeSettings() { calls.push('sync'); },
    });

    await controller.choose();

    expect(calls).toEqual(['pick', 'align', 'save', 'sync', 'publish']);
    expect(saved).toEqual([logHandle]);
    expect(markers).toEqual([{
      'jspider.logDirectoryName': 'log',
      'jspider.logDirectoryPath': 'C:\\work\\JSpider-follow-season\\log',
      'jspider.logDirectoryDraft': 'C:\\work\\JSpider-follow-season\\log',
      'jspider.logDirectoryRevision': expect.any(Number),
    }]);
    expect(view.state.textContent).toBe(
      'CONFIG E CHROMIUM ALLINEATI · C:\\work\\JSpider-follow-season\\log · config root e dist aggiornati. Puoi chiudere questa scheda.',
    );
  });

  it('reports a cancelled selection without storing anything', async () => {
    const view = fixture();
    view.pathInput.value = 'C:\\work\\JSpider\\log';
    const controller = initializeLogDirectoryPicker(view, {
      async pickProject() { throw new DOMException('cancelled', 'AbortError'); },
      async align() { throw new Error('must not align'); },
      async saveLog() { throw new Error('must not save'); },
      async publish() { throw new Error('must not publish'); },
      async synchronizeSettings() { throw new Error('must not synchronize'); },
    });

    await controller.choose();

    expect(view.state.textContent).toContain('Chromium ha annullato il selettore dopo la scelta');
    expect(view.state.textContent).toContain('Conferma cartella già autorizzata');
  });

  it('does not open the picker without a complete path', async () => {
    const view = fixture();
    let picked = false;
    const controller = initializeLogDirectoryPicker(view, {
      async pickProject() { picked = true; return {} as never; },
      async align() { throw new Error('must not align'); },
      async saveLog() { throw new Error('must not save'); },
      async publish() { throw new Error('must not publish'); },
      async synchronizeSettings() { throw new Error('must not synchronize'); },
    });

    await controller.choose();

    expect(picked).toBe(false);
    expect(view.state.textContent).toContain('percorso completo');
  });
});
