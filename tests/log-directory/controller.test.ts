// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { initializeLogDirectoryPicker } from '../../src/log-directory/controller';

function fixture() {
  document.body.innerHTML = '<button id="choose">Scegli</button><p id="state"></p>';
  return {
    chooseButton: document.querySelector<HTMLButtonElement>('#choose')!,
    state: document.querySelector<HTMLElement>('#state')!,
  };
}

describe('top-level log directory picker', () => {
  it('stores the selected writable folder and publishes its name', async () => {
    const view = fixture();
    const saved: unknown[] = [];
    const markers: Record<string, unknown>[] = [];
    const handle = { name: 'log' };
    const controller = initializeLogDirectoryPicker(view, {
      async pick() { return handle as never; },
      async save(value) { saved.push(value); },
      async publish(items) { markers.push(items); },
    });

    await controller.choose();

    expect(saved).toEqual([handle]);
    expect(markers).toEqual([{
      'jspider.logDirectoryName': 'log',
      'jspider.logDirectoryRevision': expect.any(Number),
    }]);
    expect(view.state.textContent).toBe('Cartella “log” collegata. Puoi chiudere questa scheda.');
  });

  it('reports a cancelled selection without storing anything', async () => {
    const view = fixture();
    const controller = initializeLogDirectoryPicker(view, {
      async pick() { throw new DOMException('cancelled', 'AbortError'); },
      async save() { throw new Error('must not save'); },
      async publish() { throw new Error('must not publish'); },
    });

    await controller.choose();

    expect(view.state.textContent).toBe('Selezione annullata.');
  });
});
