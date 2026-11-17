// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { initializeDismissiblePopover } from '../../src/sidebar/popover';

function fixture() {
  document.body.innerHTML = `
    <button id="settings-button" aria-expanded="false">Impostazioni</button>
    <div id="settings-panel" hidden><input id="inside"></div>
    <button id="outside">Fuori</button>`;
  return {
    button: document.querySelector<HTMLButtonElement>('#settings-button')!,
    panel: document.querySelector<HTMLElement>('#settings-panel')!,
    inside: document.querySelector<HTMLInputElement>('#inside')!,
    outside: document.querySelector<HTMLButtonElement>('#outside')!,
  };
}

describe('dismissible settings popover', () => {
  it('opens, stays open for inside clicks and closes on a second trigger click', () => {
    const { button, panel, inside } = fixture();
    const dispose = initializeDismissiblePopover(button, panel, document);
    button.click();
    expect({ hidden: panel.hidden, expanded: button.getAttribute('aria-expanded') })
      .toEqual({ hidden: false, expanded: 'true' });
    inside.click();
    expect(panel.hidden).toBe(false);
    button.click();
    expect({ hidden: panel.hidden, expanded: button.getAttribute('aria-expanded') })
      .toEqual({ hidden: true, expanded: 'false' });
    dispose();
  });

  it('closes on outside click and Escape', () => {
    const { button, panel, outside } = fixture();
    const dispose = initializeDismissiblePopover(button, panel, document);
    button.click();
    outside.click();
    expect(panel.hidden).toBe(true);
    button.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.hidden).toBe(true);
    dispose();
  });
});
