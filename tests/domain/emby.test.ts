import { describe, expect, it } from 'vitest';
import {
  episodeOneFilenames,
  fileStem,
  matchingEmbyItems,
  resolveEmbyPresence,
  selectDefaultEmbySeason,
  type EmbyItem,
  type EmbySeasonSummary,
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

  it('extracts the filename from a media-source URL and ignores its stream fragment', () => {
    expect(fileStem(
      'http://10.0.0.1/download/token/Show.S05E01.2160p.mkv#tgstream/channel/41533-41534',
    )).toBe('Show.S05E01.2160p');
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

  it('exposes the same exact title/year matches used by the resolver', () => {
    const exact = item();
    expect(matchingEmbyItems([
      item({ id: 'wrong-title', name: 'Another film' }),
      item({ id: 'wrong-year', productionYear: 2025 }),
      exact,
    ], { mode: 'title', title: 'Colony', year: 2026 })).toEqual([exact]);
  });

  it('selects the highest normal season instead of specials', () => {
    const seasons: EmbySeasonSummary[] = [
      { id: 'specials', number: 0, name: 'Specials' },
      { id: 'season-2', number: 2, name: 'Season 2' },
      { id: 'season-11', number: 11, name: 'Season 11' },
    ];

    expect(selectDefaultEmbySeason(seasons)).toEqual(seasons[2]);
  });

  it('selects specials only when no normal season exists', () => {
    const specials: EmbySeasonSummary = { id: 'specials', number: 0, name: 'Specials' };
    expect(selectDefaultEmbySeason([specials])).toEqual(specials);
    expect(selectDefaultEmbySeason([])).toBeNull();
  });

  it('returns each distinct episode-one filename and ignores other episodes', () => {
    const episodeOne = {
      ...item({ path: 'D:\\Series\\Season 01\\Show.S01E01.2160p.mkv' }),
      indexNumber: 1,
      mediaSources: [
        { path: 'D:\\Series\\Season 01\\Show.S01E01.2160p.mkv' },
        { path: 'D:\\Series\\Season 01\\Show.S01E01.1080p.mkv' },
      ],
    } as EmbyItem;
    const episodeTwo = {
      ...item({ path: 'D:\\Series\\Season 01\\Show.S01E02.2160p.mkv' }),
      indexNumber: 2,
    } as EmbyItem;

    expect(episodeOneFilenames([episodeTwo, episodeOne])).toEqual([
      'Show.S01E01.2160p',
      'Show.S01E01.1080p',
    ]);
  });

  it('uses FileName only as fallback when real episode paths are available', () => {
    const episode = {
      ...item({
        path: 'D:\\Series\\Season 01\\Show.S01E01.2160p.mkv',
        fileName: '23451',
      }),
      indexNumber: 1,
      mediaSources: [{ path: 'D:\\Series\\Season 01\\Show.S01E01.1080p.mkv' }],
    } as EmbyItem;

    expect(episodeOneFilenames([episode])).toEqual([
      'Show.S01E01.2160p',
      'Show.S01E01.1080p',
    ]);
  });

  it('deduplicates strm paths and media-source URLs for the same episode version', () => {
    const episode = {
      ...item({ path: 'D:\\Series\\Show.S05E01.2160p.strm' }),
      indexNumber: 1,
      mediaSources: [{
        path: 'http://10.0.0.1/download/token/Show.S05E01.2160p.mkv#tgstream/channel/41533',
      }],
    } as EmbyItem;

    expect(episodeOneFilenames([episode])).toEqual(['Show.S05E01.2160p']);
  });

  it('does not substitute another episode when episode one is absent', () => {
    const episodeTwo = {
      ...item({ path: 'D:\\Series\\Season 01\\Show.S01E02.1080p.mkv' }),
      indexNumber: 2,
    } as EmbyItem;
    expect(episodeOneFilenames([episodeTwo])).toEqual([]);
  });
});
