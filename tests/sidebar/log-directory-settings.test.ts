// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  initializeLogDirectorySettings,
  renderLogDirectoryStatus,
} from '../../src/sidebar/log-directory-settings';

function fixture() {
  document.body.innerHTML = '<input id="path"><p id="state"></p><button id="choose" type="button"></button>';
  return {
    pathInput: document.querySelector<HTMLInputElement>('#path')!,
    state: document.querySelector<HTMLElement>('#state')!,
    chooseButton: document.querySelector<HTMLButtonElement>('#choose')!,
  };
}

describe('log directory settings', () => {
  it('renders explicit missing, unauthorized, mismatched, and aligned states', () => {
    const view = fixture();
    renderLogDirectoryStatus(view, {
      configured: false, name: null, permission: 'missing', configuredPath: '', authorizedPath: null,
    });
    expect(view.state.textContent).toContain('CONFIG MANCANTE');
    expect(view.chooseButton.textContent).toBe('Allinea cartella progetto e config');

    renderLogDirectoryStatus(view, {
      configured: false, name: null, permission: 'missing',
      configuredPath: 'C:\\work\\JSpider\\log', authorizedPath: null,
    });
    expect(view.state.textContent).toBe(
      'CHROMIUM NON AUTORIZZATO · config: C:\\work\\JSpider\\log.',
    );

    renderLogDirectoryStatus(view, {
      configured: true, name: 'log', permission: 'granted',
      configuredPath: 'C:\\work\\JSpider\\log',
      authorizedPath: 'C:\\work\\Other\\log',
    });
    expect(view.state.textContent).toBe(
      'NON ALLINEATI · config: C:\\work\\JSpider\\log · Chromium: C:\\work\\Other\\log.',
    );

    renderLogDirectoryStatus(view, {
      configured: true, name: 'log', permission: 'granted',
      configuredPath: 'C:\\work\\JSpider\\log',
      authorizedPath: 'C:\\work\\JSpider\\log',
    });
    expect(view.state.textContent).toBe(
      'CONFIG E CHROMIUM ALLINEATI · C:\\work\\JSpider\\log.',
    );
    expect(view.chooseButton.textContent).toBe('Cambia cartella progetto');
  });

  it('opens the authorization page and can refresh the current status', async () => {
    const view = fixture();
    view.pathInput.value = 'C:\\work\\JSpider\\log';
    let opened = 0;
    let openedPath = '';
    const controller = initializeLogDirectorySettings(view, {
      async loadStatus() {
        return {
          configured: true, name: 'log', permission: 'granted',
          configuredPath: 'C:\\work\\JSpider\\log',
          authorizedPath: 'C:\\work\\JSpider\\log',
        };
      },
      async openPicker(path) { opened += 1; openedPath = path; },
    });

    await controller.refresh();
    expect(view.pathInput.value).toBe('C:\\work\\JSpider\\log');
    view.chooseButton.click();
    await Promise.resolve();

    expect(view.state.textContent).toContain('cartella progetto');
    expect(opened).toBe(1);
    expect(openedPath).toBe('C:\\work\\JSpider\\log');
    controller.dispose();
  });

  it('blocks an empty path before opening the picker', async () => {
    const view = fixture();
    let opened = false;
    const controller = initializeLogDirectorySettings(view, {
      async loadStatus() {
        return {
          configured: false, name: null, permission: 'missing', configuredPath: '', authorizedPath: null,
        };
      },
      async openPicker() { opened = true; },
    });

    view.chooseButton.click();
    await Promise.resolve();

    expect(opened).toBe(false);
    expect(view.state.textContent).toContain('percorso completo');
  });
});
