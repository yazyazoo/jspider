// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { initializeTooltips } from '../../src/sidebar/tooltips';

function fixture() {
  document.body.innerHTML = `
    <button id="info" data-tooltip aria-describedby="tip">i</button>
    <span id="tip" role="tooltip" hidden>Informazione</span>
    <button id="outside">Fuori</button>
    <p id="status" role="status">Errore visibile</p>`;
  return {
    trigger: document.querySelector<HTMLButtonElement>('#info')!,
    tooltip: document.querySelector<HTMLElement>('#tip')!,
    outside: document.querySelector<HTMLButtonElement>('#outside')!,
  };
}

describe('information tooltips', () => {
  it('keeps a hovered tooltip open when the icon is clicked and pins it for pointer exit', () => {
    const { trigger, tooltip } = fixture();
    const dispose = initializeTooltips(document);
    trigger.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    expect(tooltip.hidden).toBe(false);
    trigger.click();
    expect(tooltip.hidden).toBe(false);
    trigger.dispatchEvent(new PointerEvent('pointerout', {
      bubbles: true, relatedTarget: document.querySelector('#outside'),
    }));
    expect(tooltip.hidden).toBe(false);
    trigger.click();
    expect(tooltip.hidden).toBe(true);
    dispose();
  });

  it('aligns the tooltip top-left corner below the icon', () => {
    const { trigger, tooltip } = fixture();
    trigger.getBoundingClientRect = () => ({
      x: 123, y: 30, left: 123, top: 30, right: 143, bottom: 50,
      width: 20, height: 20, toJSON: () => ({}),
    });
    const dispose = initializeTooltips(document);
    trigger.click();
    expect(tooltip.style.left).toBe('123px');
    expect(tooltip.style.top).toBe('57px');
    dispose();
  });

  it('shifts left near the right edge so the whole tooltip stays in the window', () => {
    const { trigger, tooltip } = fixture();
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true, value: 900,
    });
    trigger.getBoundingClientRect = () => ({
      x: 850, y: 30, left: 850, top: 30, right: 870, bottom: 50,
      width: 20, height: 20, toJSON: () => ({}),
    });
    tooltip.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 80,
      width: 320, height: 80, toJSON: () => ({}),
    });
    const dispose = initializeTooltips(document);
    trigger.click();
    expect(tooltip.style.left).toBe('568px');
    expect(Number.parseInt(tooltip.style.left, 10) + 320).toBeLessThanOrEqual(888);
    dispose();
  });

  it('opens above the icon when there is not enough room below', () => {
    const { trigger, tooltip } = fixture();
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true, value: 600,
    });
    trigger.getBoundingClientRect = () => ({
      x: 123, y: 570, left: 123, top: 570, right: 143, bottom: 590,
      width: 20, height: 20, toJSON: () => ({}),
    });
    tooltip.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 100,
      width: 320, height: 100, toJSON: () => ({}),
    });
    const dispose = initializeTooltips(document);
    trigger.click();
    expect(tooltip.style.top).toBe('463px');
    dispose();
  });

  it('opens from keyboard focus and closes after focus leaves', () => {
    const { trigger, tooltip, outside } = fixture();
    const dispose = initializeTooltips(document);
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tooltip.hidden).toBe(false);
    trigger.dispatchEvent(new FocusEvent('focusout', {
      bubbles: true, relatedTarget: outside,
    }));
    expect(tooltip.hidden).toBe(true);
    dispose();
  });

  it('closes with Escape and an outside click', () => {
    const { trigger, tooltip, outside } = fixture();
    const dispose = initializeTooltips(document);
    trigger.click();
    expect(tooltip.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(tooltip.hidden).toBe(true);
    trigger.click();
    outside.click();
    expect(tooltip.hidden).toBe(true);
    dispose();
  });

  it('closes after the pointer leaves both trigger and tooltip', () => {
    const { trigger, tooltip, outside } = fixture();
    const dispose = initializeTooltips(document);
    trigger.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    tooltip.dispatchEvent(new PointerEvent('pointerout', {
      bubbles: true, relatedTarget: outside,
    }));
    expect(tooltip.hidden).toBe(true);
    dispose();
  });

  it('does not hide operational status inside a tooltip', () => {
    fixture();
    const dispose = initializeTooltips(document);
    const status = document.querySelector<HTMLElement>('#status')!;
    expect(status.hidden).toBe(false);
    expect(status.closest('[role="tooltip"]')).toBeNull();
    dispose();
  });
});

