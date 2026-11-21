import { describe, expect, it } from 'vitest';
import {
  applyThankReplacements,
  createBitrateLimitState,
  reconcileSelection,
  resolveThanksPresentation,
  shouldSubmitSelectionThanks,
  shouldAutoSearchTmdb,
  validateUnlockedSelection,
} from '../../src/sidebar/state';

describe('sidebar selection state', () => {
  it('uses recommendations initially but preserves an explicit selection across refreshes', () => {
    expect(reconcileSelection([], false, ['4k', '1080'], ['4k'])).toEqual(['4k']);
    expect(reconcileSelection(['1080'], true, ['4k', '1080'], ['4k'])).toEqual(['1080']);
  });

  it('replaces a selected locked placeholder with all versions revealed by thanks', () => {
    expect(applyThankReplacements(
      ['locked', 'other'], { locked: ['1080-source', '1080-encode'] },
      ['1080-source', '1080-encode', 'other'],
    )).toEqual(['1080-source', '1080-encode', 'other']);
  });
});

describe('automatic TMDB lookup', () => {
  it('runs only with a configured credential and a known media kind', () => {
    expect(shouldAutoSearchTmdb(true, 'movie')).toBe(true);
    expect(shouldAutoSearchTmdb(true, 'tv')).toBe(true);
    expect(shouldAutoSearchTmdb(false, 'movie')).toBe(false);
    expect(shouldAutoSearchTmdb(true, '')).toBe(false);
  });
});

describe('bitrate limit persistence', () => {
  it('keeps only the latest value and restores it in a later sidebar session', async () => {
    const values: Record<string, unknown> = {};
    const storage = {
      async get(key: string) { return { [key]: values[key] }; },
      async set(items: Record<string, unknown>) { Object.assign(values, items); },
    };
    const firstSession = createBitrateLimitState(storage);

    await firstSession.save('54');
    await firstSession.save('42.5');

    expect(values).toEqual({ 'jspider.bitrateLimitMbps': '42.5' });
    await expect(createBitrateLimitState(storage).load()).resolves.toBe('42.5');
  });

  it('persists an empty value as no limit and rejects malformed stored values', async () => {
    const values: Record<string, unknown> = { 'jspider.bitrateLimitMbps': 'not-a-number' };
    const storage = {
      async get(key: string) { return { [key]: values[key] }; },
      async set(items: Record<string, unknown>) { Object.assign(values, items); },
    };
    const state = createBitrateLimitState(storage);

    await expect(state.load()).resolves.toBe('');
    await state.save('');
    expect(values).toEqual({ 'jspider.bitrateLimitMbps': '' });
  });
});

describe('thanks presentation', () => {
  it('replaces a locked container with its dedicated unlock action', () => {
    expect(resolveThanksPresentation('unlock-container')).toEqual({
      showUnlock: true,
      showSelection: false,
      selectionLabel: 'Ringrazia le versioni selezionate',
    });
  });

  it('turns selection thanks into local confirmation after container unlock', () => {
    expect(resolveThanksPresentation('validate-selection')).toEqual({
      showUnlock: false,
      showSelection: true,
      selectionLabel: 'Conferma le versioni selezionate',
    });
    expect(shouldSubmitSelectionThanks('validate-selection')).toBe(false);
    expect(validateUnlockedSelection([
      { locked: false, linksLoaded: true, links: ['https://terabytez.org/file.rar'] },
    ])).toBeNull();
    expect(validateUnlockedSelection([
      { locked: false, linksLoaded: true, links: [] },
    ])).toBe('Una o più versioni selezionate non hanno link disponibili.');
  });

  it('preserves remote selection thanks for normal articles', () => {
    expect(resolveThanksPresentation('selection')).toEqual({
      showUnlock: false,
      showSelection: true,
      selectionLabel: 'Ringrazia le versioni selezionate',
    });
    expect(shouldSubmitSelectionThanks('selection')).toBe(true);
    expect(shouldSubmitSelectionThanks(undefined)).toBe(true);
  });
});

