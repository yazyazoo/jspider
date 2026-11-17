// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { initializeFullWebUiToggle } from '../../src/sidebar/full-webui';

function fixture() {
  document.body.innerHTML = `
    <div id="home"></div>
    <div id="panel" hidden></div>
    <button id="toggle">Apri WebUI TaskFlow</button>
    <p id="status"></p>`;
  return {
    home: document.querySelector<HTMLElement>('#home')!,
    panel: document.querySelector<HTMLElement>('#panel')!,
    button: document.querySelector<HTMLButtonElement>('#toggle')!,
    status: document.querySelector<HTMLElement>('#status')!,
  };
}

describe('full TaskFlow WebUI inside JSpider', () => {
  it('opens inside JSpider with the saved token callback and closes back to Home', async () => {
    const view = fixture();
    const ui = document.createElement('div') as HTMLDivElement & {
      configure(configuration: unknown): void;
      view: string;
    };
    let configuredApiUrl = '';
    let configuredTheme = '';
    let getAccessToken: (() => Promise<string | null> | string | null) | undefined;
    ui.configure = (value) => {
      const configuration = value as {
        apiUrl?: string;
        getAccessToken?: () => Promise<string | null> | string | null;
        theme?: string;
      };
      configuredApiUrl = configuration.apiUrl ?? '';
      configuredTheme = configuration.theme ?? '';
      getAccessToken = configuration.getAccessToken;
    };
    ui.view = '';
    initializeFullWebUiToggle(view, {
      loadConfiguration: async () => ({
        apiUrl: 'https://taskflow.example',
        getAccessToken: async () => 'private-admin-token',
        theme: 'dark',
      }),
      createUi: async () => ui,
    });

    view.button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(view.home.hidden).toBe(true);
    expect(view.panel.hidden).toBe(false);
    expect(view.panel.firstElementChild).toBe(ui);
    expect(ui.view).toBe('dashboard');
    expect({ configuredApiUrl, configuredTheme }).toEqual({
      configuredApiUrl: 'https://taskflow.example', configuredTheme: 'dark',
    });
    expect(await getAccessToken?.()).toBe('private-admin-token');
    expect(view.button.textContent).toBe('Torna a JSpider');

    view.button.click();
    expect(view.home.hidden).toBe(false);
    expect(view.panel.hidden).toBe(true);
    expect(view.button.textContent).toBe('Apri WebUI TaskFlow');
  });

  it('keeps Home visible and reports a missing token', async () => {
    const view = fixture();
    initializeFullWebUiToggle(view, {
      loadConfiguration: async () => { throw new Error('Token TaskFlow non configurato.'); },
      createUi: async () => { throw new Error('non deve creare la WebUI'); },
    });

    view.button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(view.home.hidden).toBe(false);
    expect(view.panel.hidden).toBe(true);
    expect(view.status.textContent).toBe('WebUI TaskFlow non disponibile: Token TaskFlow non configurato.');
  });

  it('creates a fresh component after an initial configuration failure', async () => {
    const view = fixture();
    let creations = 0;
    initializeFullWebUiToggle(view, {
      loadConfiguration: async () => ({ apiUrl: 'https://taskflow.example' }),
      createUi: async () => {
        creations += 1;
        const ui = document.createElement('div') as HTMLDivElement & {
          configure(): void;
          view: string;
        };
        ui.view = '';
        ui.configure = () => {
          if (creations === 1) throw new Error('configurazione temporaneamente fallita');
        };
        return ui;
      },
    });

    view.button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(view.panel.hidden).toBe(true);

    view.button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(creations).toBe(2);
    expect(view.panel.firstElementChild).not.toBeNull();
    expect(view.panel.hidden).toBe(false);
  });
});
