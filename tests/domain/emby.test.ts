import { describe, expect, it } from 'vitest';
import {
  fileStem,
  resolveEmbyPresence,
  type EmbyItem,
} from '../../src/domain/emby';

const item = (overrides: Partial<EmbyItem> = {}): EmbyItem => ({
  id: 'emby-1',
  name: 'Colony',
  type: 'Movie',
  productionYear: 2026,
  path: 'D:\\Film\\Colony.2026.2160p.REMUX.mkv',
  providerIds: { Tmdb: '123' },
  mediaSources: [],
  ...overrides,
});

describe('Emby presence resolver', () => {
  it('keeps only the filename and removes its last extension', () => {
    expect(fileStem('D:\\Film\\Colony.2026.2160p.REMUX.mkv'))
      .toBe('Colony.2026.2160p.REMUX');
    expect(fileStem('/media/Film.Name.1080p.tar.mkv')).toBe('Film.Name.1080p.tar');
  });

  it('classifies an exact TMDB match as present', () => {
    expect(resolveEmbyPresence([item()], { mode: 'tmdb' })).toEqual({
      state: 'present',
      files: ['Colony.2026.2160p.REMUX'],
    });
  });

  it('returns all distinct filenames for multiple versions', () => {
    const result = resolveEmbyPresence([
      item(),
      item({
        id: 'emby-2',
        path: 'D:\\Film\\Colony.2026.1080p.WEB-DL.mkv',
      }),
    ], { mode: 'tmdb' });
    expect(result).toEqual({
      state: 'present',
      files: ['Colony.2026.2160p.REMUX', 'Colony.2026.1080p.WEB-DL'],
    });
  });

  it('uses media sources when Emby groups versions under one item', () => {
    const result = resolveEmbyPresence([
      item({
        path: '',
        mediaSources: [
          { path: '/media/Colony.2026.2160p.mkv' },
          { path: '/media/Colony.2026.1080p.mkv' },
        ],
      }),
    ], { mode: 'tmdb' });
    expect(result.files).toEqual(['Colony.2026.2160p', 'Colony.2026.1080p']);
  });

  it('classifies an empty exact result as absent', () => {
    expect(resolveEmbyPresence([], { mode: 'tmdb' })).toEqual({
      state: 'absent', files: [],
    });
  });

  it('accepts one exact local title/year fallback match', () => {
    expect(resolveEmbyPresence([
      item(),
      item({ id: 'wrong', name: 'Another film' }),
    ], { mode: 'title', title: 'Colony', year: 2026 })).toEqual({
      state: 'present', files: ['Colony.2026.2160p.REMUX'],
    });
  });

  it('classifies multiple exact title/year fallback matches as ambiguous', () => {
    expect(resolveEmbyPresence([
      item(),
      item({ id: 'emby-2', path: 'D:\\Film\\Colony.2026.1080p.mkv' }),
    ], { mode: 'title', title: 'Colony', year: 2026 })).toEqual({
      state: 'ambiguous',
      files: ['Colony.2026.2160p.REMUX', 'Colony.2026.1080p'],
    });
  });
});
