import { describe, expect, it, vi } from 'vitest';
import {
  createWorkflowLogFilename,
  FollowLogHistoryReader,
  readDirectoryPermission,
  QuickWorkflowFileWriter,
  waitForTransaction,
  type LogDirectoryRepositoryLike,
} from '../../src/background/log-directory';
import type { FollowSeasonKey } from '../../src/domain/follow-season';
import type { QuickWorkflowLogDocument } from '../../src/background/quick-workflow-log';

function document(fileName = '2026-11-17_17-32-05-006_Film.json'): QuickWorkflowLogDocument {
  return {
    runId: 'run-1',
    workflowName: 'Film',
    fileName,
    startedAt: '2026-11-17T16:32:05.006Z',
    updatedAt: '2026-11-17T16:32:05.006Z',
    entries: [],
  };
}

describe('Quick Workflow log directory', () => {
  it('waits for the IndexedDB transaction commit and rejects an abort', async () => {
    const committed = { error: null, oncomplete: null, onerror: null, onabort: null } as unknown as IDBTransaction;
    const commit = waitForTransaction(committed);
    committed.oncomplete!(new Event('complete') as never);
    await expect(commit).resolves.toBeUndefined();

    const aborted = {
      error: new DOMException('aborted', 'AbortError'),
      oncomplete: null, onerror: null, onabort: null,
    } as unknown as IDBTransaction;
    const abort = waitForTransaction(aborted);
    aborted.onabort!(new Event('abort') as never);
    await expect(abort).rejects.toThrow('aborted');
  });

  it('builds a safe distinct filename from workflow and local date-time', () => {
    const first = new Date(2026, 10, 17, 17, 32, 5, 6).toISOString();
    const second = new Date(2026, 10, 17, 17, 32, 5, 7).toISOString();

    expect(createWorkflowLogFilename('  A/B:C*?"<>|   ', first))
      .toBe('2026-11-17_17-32-05-006_A_B_C.json');
    expect(createWorkflowLogFilename('  A/B:C*?"<>|   ', second))
      .toBe('2026-11-17_17-32-05-007_A_B_C.json');
  });

  it('writes the complete pretty JSON into the selected directory', async () => {
    let contents = '';
    const close = vi.fn();
    const directory = {
      name: 'log',
      async queryPermission() { return 'granted' as PermissionState; },
      async getFileHandle(name: string, options?: { create?: boolean }) {
        expect({ name, options }).toEqual({
          name: '2026-11-17_17-32-05-006_Film.json', options: { create: true },
        });
        return {
          async createWritable() {
            return {
              async write(value: string) { contents = value; },
              close,
            };
          },
        };
      },
    };
    const repository: LogDirectoryRepositoryLike = { async load() { return directory as never; } };

    await expect(new QuickWorkflowFileWriter(repository).write(document())).resolves.toBe(true);

    expect(JSON.parse(contents)).toEqual(document());
    expect(contents.endsWith('\n')).toBe(true);
    expect(close).toHaveBeenCalledOnce();
  });

  it('keeps a saved directory configured when Chromium cannot query its permission', async () => {
    const directory = {
      name: 'log',
      async queryPermission() { throw new TypeError('queryPermission is unavailable'); },
    };

    await expect(readDirectoryPermission(directory as never)).resolves.toBe('unknown');
  });

  it('tries the saved handle when only the permission query is unavailable', async () => {
    const getFileHandle = vi.fn(async () => ({
      async createWritable() {
        return { async write() {}, async close() {} };
      },
    }));
    const writer = new QuickWorkflowFileWriter({
      async load() {
        return {
          name: 'log',
          async queryPermission() { throw new TypeError('queryPermission is unavailable'); },
          getFileHandle,
        } as never;
      },
    });

    await expect(writer.write(document())).resolves.toBe(true);
    expect(getFileHandle).toHaveBeenCalledOnce();
  });

  it('does not write when no folder is configured or its permission expired', async () => {
    const absent = new QuickWorkflowFileWriter({ async load() { return null; } });
    const expired = new QuickWorkflowFileWriter({
      async load() {
        return {
          name: 'log',
          async queryPermission() { return 'prompt' as PermissionState; },
          getFileHandle: vi.fn(),
        } as never;
      },
    });

    await expect(absent.write(document())).resolves.toBe(false);
    await expect(expired.write(document())).resolves.toBe(false);
  });
});

describe('Follow log history index', () => {
  const key: FollowSeasonKey = {
    mediaKind: 'tv', tmdbId: 12345, season: 10, hosts: ['terabytez.org'],
  };
  const matching = '2026-11-16_10-00-00-000_follow_tmdb-tv-12345_host-terabytez_MasterChef_S10.json';
  const otherHost = '2026-11-15_10-00-00-000_follow_tmdb-tv-12345_host-filestore_MasterChef_S10.json';
  const unrelated = '2026-11-14_10-00-00-000_follow_tmdb-tv-999_host-terabytez_Other_S01.json';

  function log(fileName: string, started = true): string {
    return JSON.stringify({
      runId: fileName, workflowName: 'MasterChef', fileName,
      startedAt: '2026-11-16T09:00:00.000Z', updatedAt: '2026-11-16T09:01:00.000Z',
      entries: [
        {
          timestamp: '2026-11-16T09:00:01.000Z', phase: 'submission', kind: 'request',
          payload: { packages: [{ name: 'S10', links: ['https://terabytez.org/aaaaaaaaaaaa'] }] },
        },
        {
          timestamp: '2026-11-16T09:01:00.000Z', phase: 'start',
          kind: started ? 'response' : 'error', payload: {},
        },
      ],
    });
  }

  function directory(files: Record<string, string>, opened: string[]) {
    return {
      name: 'log',
      async queryPermission() { return 'granted' as PermissionState; },
      async *entries() {
        for (const name of Object.keys(files)) yield [name, { kind: 'file', name }];
      },
      async getFileHandle(name: string) {
        opened.push(name);
        return { async getFile() { return { async text() { return files[name]; } }; } };
      },
    };
  }

  it('opens only same-series-season files and returns exact-host history', async () => {
    const opened: string[] = [];
    const reader = new FollowLogHistoryReader({ async load() {
      return directory({
        [matching]: log(matching),
        [otherHost]: log(otherHost, false),
        [unrelated]: '{ definitely not json',
        'notes.json': '{ also not json',
      }, opened) as never;
    } });

    const result = await reader.read(key);

    expect(result.documents).toHaveLength(1);
    expect(result.matchedFiles).toBe(1);
    expect(result.historicalHosts).toEqual(['terabytez.org']);
    expect(opened.sort()).toEqual([matching, otherHost].sort());
  });

  it('blocks when an exact-chain file is malformed', async () => {
    const reader = new FollowLogHistoryReader({ async load() {
      return directory({ [matching]: '{ broken' }, []) as never;
    } });

    await expect(reader.read(key)).rejects.toThrow(`Log Segui illeggibile: ${matching}`);
  });

  it('blocks an indexed file whose internal filename belongs to another log', async () => {
    const reader = new FollowLogHistoryReader({ async load() {
      const renamed = JSON.parse(log(matching)) as Record<string, unknown>;
      renamed.fileName = otherHost;
      return directory({ [matching]: JSON.stringify(renamed) }, []) as never;
    } });

    await expect(reader.read(key)).rejects.toThrow(`Log Segui illeggibile: ${matching}`);
  });

  it('reports missing directory permission explicitly', async () => {
    const reader = new FollowLogHistoryReader({ async load() {
      return {
        name: 'log', async queryPermission() { return 'prompt' as PermissionState; },
      } as never;
    } });

    await expect(reader.read(key)).rejects.toThrow('Permesso alla cartella log');
  });
});
