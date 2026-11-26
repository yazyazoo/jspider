import { describe, expect, it } from 'vitest';
import {
  createFollowLogFilename,
  parseFollowLogFilename,
  prepareFollowVariants,
  readProcessedFollowLinks,
  type FollowSeasonLogContext,
} from '../../src/domain/follow-season';
import type { ReleaseVariant } from '../../src/domain/models';

const context: FollowSeasonLogContext = {
  mediaKind: 'tv', tmdbId: 12345, season: 10,
  hosts: ['terabytez.org', 'filestore.me'], title: 'MasterChef: Italia',
};

function variant(key: string, links: string[]): ReleaseVariant {
  return {
    key, packageName: key, password: '', links, linksLoaded: true, season: 10,
    technical: {
      codec: '', bitDepth: null, resolution: null, videoBitrate: null,
      overallBitrate: null, videoBytes: null, totalBytes: null, duration: null,
      width: null, height: null, fps: null, hdr: '', category: 'unknown',
      sourceFamily: '', provider: '', bitrateEstimated: false,
    },
  };
}

function successfulLog(...links: string[]): unknown {
  return {
    runId: 'run-1', workflowName: 'MasterChef', fileName: 'indexed.json',
    startedAt: '2026-11-23T13:32:11.004Z', updatedAt: '2026-11-23T13:32:12.004Z',
    entries: [
      {
        timestamp: '2026-11-23T13:32:11.100Z', phase: 'submission', kind: 'request',
        payload: { autodownload: true, packages: [{ name: 'S10', links }] },
      },
      {
        timestamp: '2026-11-23T13:32:12.004Z', phase: 'start', kind: 'response',
        payload: { id: 'workflow-1', status: 'waiting_packages' },
      },
    ],
  };
}

describe('follow-season identity', () => {
  it('builds a chronological readable filename with canonical hosts', () => {
    expect(createFollowLogFilename(context, new Date(2026, 10, 23, 14, 32, 11, 4).toISOString()))
      .toBe('2026-11-23_14-32-11-004_follow_tmdb-tv-12345_host-filestore+terabytez_MasterChef_Italia_S10.json');
  });

  it('parses the key independently from the readable title and host input order', () => {
    const filename = '2026-11-23_14-32-11-004_follow_tmdb-tv-12345_host-filestore+terabytez_MasterChef_Italia_S10.json';
    expect(parseFollowLogFilename(filename)).toEqual({
      mediaKind: 'tv', tmdbId: 12345, season: 10,
      hosts: ['filestore.me', 'terabytez.org'],
    });
    expect(parseFollowLogFilename('2026-11-23_14-32-11-004_Quick_Workflow.json')).toBeNull();
  });
});

describe('follow-season history', () => {
  it('unions exact archive URLs from every successfully started weekly log', () => {
    const links = readProcessedFollowLinks([
      successfulLog('https://terabytez.org/aaaaaaaaaaaa'),
      successfulLog(
        'https://terabytez.org/aaaaaaaaaaaa',
        'https://terabytez.org/bbbbbbbbbbbb',
      ),
    ]);

    expect([...links]).toEqual([
      'https://terabytez.org/aaaaaaaaaaaa',
      'https://terabytez.org/bbbbbbbbbbbb',
    ]);
  });

  it('ignores a valid log that never reached a successful Start response', () => {
    const failed = successfulLog('https://terabytez.org/aaaaaaaaaaaa') as {
      entries: Array<Record<string, unknown>>;
    };
    failed.entries[1] = {
      timestamp: '2026-11-23T13:32:12.004Z', phase: 'start', kind: 'error',
      payload: { message: 'queue offline' },
    };

    expect([...readProcessedFollowLinks([failed])]).toEqual([]);
  });

  it('rejects malformed matching history instead of risking duplicate submissions', () => {
    expect(() => readProcessedFollowLinks([{ entries: 'broken' }]))
      .toThrow('Log Segui non valido');

    const missingSubmission = successfulLog('https://terabytez.org/aaaaaaaaaaaa') as {
      entries: Array<Record<string, unknown>>;
    };
    missingSubmission.entries.shift();
    expect(() => readProcessedFollowLinks([missingSubmission]))
      .toThrow('Submission mancante');
  });
});

describe('follow-season URL delta', () => {
  it('keeps only new exact links on selected hosts and omits empty variants', () => {
    const result = prepareFollowVariants([
      variant('old', ['https://terabytez.org/aaaaaaaaaaaa']),
      variant('mixed', [
        'https://filestore.me/cccccccccccc',
        'https://terabytez.org/bbbbbbbbbbbb',
        'https://example.org/not-an-archive.rar',
      ]),
    ], ['terabytez.org'], new Set([
      'https://terabytez.org/aaaaaaaaaaaa',
    ]));

    expect(result.variants).toHaveLength(1);
    expect(result.variants[0]).toMatchObject({
      key: 'mixed', links: ['https://terabytez.org/bbbbbbbbbbbb'],
    });
    expect(result).toMatchObject({ currentCount: 2, processedCount: 1, newCount: 1 });
  });

  it('treats the same file on another host as a separate exact URL', () => {
    const result = prepareFollowVariants([
      variant('same-name', [
        'https://terabytez.org/files/show.part01.rar',
        'https://filestore.me/files/show.part01.rar',
      ]),
    ], ['filestore.me'], new Set([
      'https://terabytez.org/files/show.part01.rar',
    ]));

    expect(result.variants[0]?.links).toEqual([
      'https://filestore.me/files/show.part01.rar',
    ]);
  });

  it('sends a current exact URL only once when two variants contain it', () => {
    const duplicate = 'https://terabytez.org/aaaaaaaaaaaa';
    const result = prepareFollowVariants([
      variant('first', [duplicate]),
      variant('second', [duplicate, 'https://terabytez.org/bbbbbbbbbbbb']),
    ], ['terabytez.org'], new Set());

    expect(result.variants.map(({ key, links }) => ({ key, links }))).toEqual([
      { key: 'first', links: [duplicate] },
      { key: 'second', links: ['https://terabytez.org/bbbbbbbbbbbb'] },
    ]);
    expect(result.newCount).toBe(2);
  });
});
