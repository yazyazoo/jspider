// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createOverlayController,
  OVERLAY_STORAGE_KEY,
  OVERLAY_WIDTHS,
} from '../../src/content/overlay';

function storage(initial: unknown = undefined) {
  const values: Record<string, unknown> = initial === undefined
    ? {} : { [OVERLAY_STORAGE_KEY]: initial };
  return {
    values,
    async get(key: string) { return { [key]: values[key] }; },
    async set(items: Record<string, unknown>) { Object.assign(values, items); },
  };
}

beforeEach(() => { document.body.replaceChildren(); });

describe('JSpider page overlay', () => {
  it('opens and closes one local iframe with the persisted width', async () => {
    const saved = storage(780);
    const overlay = createOverlayController(
      document,
      (path) => `chrome-extension://jspider/${path}`,
      saved,
    );

    await expect(overlay.toggle()).resolves.toEqual({ open: true, width: 780 });
    const host = document.getElementById('jspider-overlay-host');
    const frame = host?.shadowRoot?.querySelector('iframe');
    expect(frame?.src).toBe('chrome-extension://jspider/sidebar.html?surface=overlay');
    expect(frame?.style.width).toBe('780px');
    expect(frame?.style.maxWidth).toBe('calc(100vw - 24px)');

    await expect(overlay.toggle()).resolves.toEqual({ open: false, width: 780 });
    expect(document.getElementById('jspider-overlay-host')).toBeNull();
  });

  it('falls back to 650px when storage contains an unsupported width', async () => {
    const overlay = createOverlayController(document, (path) => path, storage(999));
    await expect(overlay.toggle()).resolves.toEqual({ open: true, width: 650 });
  });

  it('serializes rapid toggles so the second click closes the first overlay', async () => {
    const overlay = createOverlayController(document, (path) => path, storage());
    const first = overlay.toggle();
    const second = overlay.toggle();
    await expect(first).resolves.toEqual({ open: true, width: 650 });
    await expect(second).resolves.toEqual({ open: false, width: 650 });
    expect(document.getElementById('jspider-overlay-host')).toBeNull();
  });

  it('resizes immediately and persists only one of the five allowed widths', async () => {
    const saved = storage();
    const overlay = createOverlayController(document, (path) => path, saved);
    await overlay.toggle();

    await expect(overlay.resize(900)).resolves.toEqual({ open: true, width: 900 });
    expect(saved.values[OVERLAY_STORAGE_KEY]).toBe(900);
    const frame = document.getElementById('jspider-overlay-host')?.shadowRoot?.querySelector('iframe');
    expect(frame?.style.width).toBe('900px');
    expect(frame?.style.maxWidth).toBe('calc(100vw - 24px)');
    await expect(overlay.resize(700)).rejects.toThrow('larghezza');
    expect(OVERLAY_WIDTHS).toEqual([420, 520, 650, 780, 900]);
  });

  it('rereads the persisted width when an older tab reopens its overlay', async () => {
    const shared = storage(650);
    const firstTab = createOverlayController(document, (path) => path, shared);
    await firstTab.toggle();
    await firstTab.toggle();

    const otherDocument = document.implementation.createHTMLDocument('second tab');
    const secondTab = createOverlayController(otherDocument, (path) => path, shared);
    await secondTab.resize(900);

    await expect(firstTab.toggle()).resolves.toEqual({ open: true, width: 900 });
  });
});
