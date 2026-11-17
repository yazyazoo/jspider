// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  initializeLogDirectorySettings,
  renderLogDirectoryStatus,
} from '../../src/sidebar/log-directory-settings';

function fixture() {
  document.body.innerHTML = '<p id="state"></p><button id="choose" type="button"></button>';
  return {
    state: document.querySelector<HTMLElement>('#state')!,
    chooseButton: document.querySelector<HTMLButtonElement>('#choose')!,
  };
}

describe('log directory settings', () => {
  it('renders missing, ready and expired folder states', () => {
    const view = fixture();
    renderLogDirectoryStatus(view, { configured: false, name: null, permission: 'missing' });
    expect(view.state.textContent).toContain('Nessuna cartella');
    expect(view.chooseButton.textContent).toBe('Scegli cartella log');

    renderLogDirectoryStatus(view, { configured: true, name: 'log', permission: 'granted' });
    expect(view.state.textContent).toBe('log · scrittura autorizzata');
    expect(view.chooseButton.textContent).toBe('Cambia cartella');

    renderLogDirectoryStatus(view, { configured: true, name: 'log', permission: 'prompt' });
    expect(view.state.textContent).toBe('log · autorizzazione da rinnovare');

    renderLogDirectoryStatus(view, { configured: true, name: 'log', permission: 'unknown' });
    expect(view.state.textContent).toBe('log · cartella salvata');
    expect(view.chooseButton.textContent).toBe('Cambia cartella');
  });

  it('opens the authorization page and can refresh the current status', async () => {
    const view = fixture();
    let opened = 0;
    const controller = initializeLogDirectorySettings(view, {
      async loadStatus() { return { configured: true, name: 'log', permission: 'granted' }; },
      async openPicker() { opened += 1; },
    });

    await controller.refresh();
    expect(view.state.textContent).toBe('log · scrittura autorizzata');
    view.chooseButton.click();
    await Promise.resolve();

    expect(view.state.textContent).toContain('nuova scheda');
    expect(opened).toBe(1);
    controller.dispose();
  });
});
