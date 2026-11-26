import { describe, expect, it } from 'vitest';
import {
  FollowSeasonPreparationController,
  describeFollowSeasonState,
  historicalHostsToAdopt,
  resolveFollowSeasonAvailability,
  type FollowPreparationResponse,
} from '../../src/sidebar/follow-season';

const available = {
  metadata: { mode: 'validated' as const, id: 12345, mediaKind: 'tv' as const },
  variants: [{ season: 10 }],
  hosts: ['terabytez.org' as const],
  createMode: 'quick' as const,
  autodownload: true,
  logStatus: { configured: true, name: 'log', permission: 'granted' as const },
};

describe('Follow season availability', () => {
  it('requires validated TV metadata, one season, Quick mode, Autodownload and log access', () => {
    expect(resolveFollowSeasonAvailability(available)).toEqual({ available: true, season: 10 });
    expect(resolveFollowSeasonAvailability({
      ...available, metadata: { mode: 'fallback', title: 'Show', year: '2026', mediaKind: 'tv' },
    })).toMatchObject({ available: false, reason: expect.stringContaining('TMDB') });
    expect(resolveFollowSeasonAvailability({
      ...available, variants: [{ season: 9 }, { season: 10 }],
    })).toMatchObject({ available: false, reason: expect.stringContaining('una sola stagione') });
    expect(resolveFollowSeasonAvailability({
      ...available, createMode: 'taskflow',
    })).toMatchObject({ available: false, reason: expect.stringContaining('Quick Workflow') });
    expect(resolveFollowSeasonAvailability({
      ...available, autodownload: false,
    })).toMatchObject({ available: false, reason: expect.stringContaining('Autodownload') });
    expect(resolveFollowSeasonAvailability({
      ...available, logStatus: { configured: false, name: null, permission: 'missing' },
    })).toMatchObject({ available: false, reason: expect.stringContaining('cartella log') });
  });
});

describe('Follow season preparation controller', () => {
  const response: FollowPreparationResponse = {
    variants: [], currentCount: 24, processedCount: 16, newCount: 8,
    matchedFiles: 2, historicalHosts: ['terabytez.org'],
  };

  it('stores the latest successful preparation for Quick Workflow', async () => {
    const controller = new FollowSeasonPreparationController();

    await expect(controller.prepare(async () => response)).resolves.toEqual(response);
    expect(controller.state()).toEqual({ pending: false, result: response, error: null });
  });

  it('rejects a stale asynchronous result after inputs are invalidated', async () => {
    let resolve!: (value: FollowPreparationResponse) => void;
    const controller = new FollowSeasonPreparationController();
    const pending = controller.prepare(() => new Promise((done) => { resolve = done; }));

    expect(controller.state().pending).toBe(true);
    controller.invalidate();
    resolve(response);

    await expect(pending).resolves.toBeNull();
    expect(controller.state()).toEqual({ pending: false, result: null, error: null });
  });

  it('exposes preparation errors and never reuses the previous result', async () => {
    const controller = new FollowSeasonPreparationController();
    await controller.prepare(async () => response);

    await expect(controller.prepare(async () => { throw new Error('Log rotto'); }))
      .rejects.toThrow('Log rotto');
    expect(controller.state()).toEqual({
      pending: false, result: null, error: 'Log rotto',
    });
  });
});

describe('Follow season presentation', () => {
  it('reports the weekly delta and keeps Quick Workflow enabled when links are new', () => {
    expect(describeFollowSeasonState({
      enabled: true,
      availability: { available: true, season: 10 },
      preparation: {
        pending: false, error: null,
        result: {
          variants: [], currentCount: 24, processedCount: 16, newCount: 8,
          matchedFiles: 2, historicalHosts: ['terabytez.org'],
        },
      },
      hosts: ['terabytez.org'],
    })).toEqual({
      text: 'Segui S10 attivo su Terabytez · 16 link già elaborati · 8 nuovi.',
      blocking: false, tone: 'active',
    });
  });

  it('blocks submission when no new exact links remain', () => {
    expect(describeFollowSeasonState({
      enabled: true,
      availability: { available: true, season: 10 },
      preparation: {
        pending: false, error: null,
        result: {
          variants: [], currentCount: 16, processedCount: 16, newCount: 0,
          matchedFiles: 2, historicalHosts: ['terabytez.org'],
        },
      },
      hosts: ['terabytez.org'],
    })).toMatchObject({
      text: 'Nessun nuovo link da elaborare per questa stagione e questo host.',
      blocking: true,
    });
  });

  it('warns without blocking when the selected host opens a new chain', () => {
    expect(describeFollowSeasonState({
      enabled: true,
      availability: { available: true, season: 10 },
      preparation: {
        pending: false, error: null,
        result: {
          variants: [], currentCount: 8, processedCount: 0, newCount: 8,
          matchedFiles: 0, historicalHosts: ['terabytez.org'],
        },
      },
      hosts: ['filestore.me'],
    })).toMatchObject({
      text: expect.stringContaining('catena host separata'),
      blocking: false,
    });
  });

  it('adopts the first successful historical host only during initial activation', () => {
    const result: FollowPreparationResponse = {
      variants: [], currentCount: 8, processedCount: 0, newCount: 8,
      matchedFiles: 0, historicalHosts: ['filestore.me'],
    };
    expect(historicalHostsToAdopt(result, ['terabytez.org'], true))
      .toEqual(['filestore.me']);
    expect(historicalHostsToAdopt(result, ['terabytez.org'], false)).toBeNull();
    expect(historicalHostsToAdopt({ ...result, matchedFiles: 1 }, ['terabytez.org'], true))
      .toBeNull();
  });
});
