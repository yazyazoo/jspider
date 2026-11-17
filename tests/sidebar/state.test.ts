import { describe, expect, it } from 'vitest';
import {
  applyThankReplacements,
  reconcileSelection,
  shouldAutoSearchTmdb,
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

