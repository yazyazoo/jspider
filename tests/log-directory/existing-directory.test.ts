// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { initializeExistingLogDirectory } from '../../src/log-directory/existing-directory';

function fixture() {
  document.body.innerHTML = `
    <input id="path" value="C:\\work\\JSpider-follow-season\\log">
    <button id="existing" type="button" hidden>Conferma</button>
    <p id="state"></p>`;
  return {
    pathInput: document.querySelector<HTMLInputElement>('#path')!,
    existingButton: document.querySelector<HTMLButtonElement>('#existing')!,
    state: document.querySelector<HTMLElement>('#state')!,
  };
}

describe('existing Chromium log directory migration', () => {
  it('automatically aligns an existing authorized log handle to the configured path', async () => {
    const view = fixture();
    const calls: string[] = [];
    const published: Record<string, unknown>[] = [];
    const handle = {
      name: 'log',
      async queryPermission() { return 'granted' as const; },
      async requestPermission() { throw new Error('permission already granted'); },
    };
    const controller = initializeExistingLogDirectory(view, {
      async loadExisting() { calls.push('load'); return handle as never; },
      async publish(items) { calls.push('publish'); published.push(items); },
    });

    await controller.refresh();

    expect(calls).toEqual(['load', 'publish']);
    expect(published).toEqual([{
      'jspider.logDirectoryName': 'log',
      'jspider.logDirectoryPath': 'C:\\work\\JSpider-follow-season\\log',
      'jspider.logDirectoryDraft': 'C:\\work\\JSpider-follow-season\\log',
      'jspider.logDirectoryRevision': expect.any(Number),
    }]);
    expect(view.state.textContent).toBe(
      'CONFIG E CHROMIUM ALLINEATI · C:\\work\\JSpider-follow-season\\log · autorizzazione Chromium già presente.',
    );
    expect(view.existingButton.hidden).toBe(true);
  });

  it('renews permission from the explicit confirmation click', async () => {
    const view = fixture();
    let requests = 0;
    const handle = {
      name: 'log',
      async queryPermission() { return 'prompt' as const; },
      async requestPermission() { requests += 1; return 'granted' as const; },
    };
    const controller = initializeExistingLogDirectory(view, {
      async loadExisting() { return handle as never; },
      async publish() {},
    });

    await controller.adopt();

    expect(requests).toBe(1);
    expect(view.state.textContent).toContain('CONFIG E CHROMIUM ALLINEATI');
  });

  it('keeps the confirmation action hidden when no legacy handle exists', async () => {
    const view = fixture();
    const controller = initializeExistingLogDirectory(view, {
      async loadExisting() { return null; },
      async publish() {},
    });

    await controller.refresh();

    expect(view.existingButton.hidden).toBe(true);
  });
});
