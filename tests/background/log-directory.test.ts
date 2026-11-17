import { describe, expect, it, vi } from 'vitest';
import {
  createWorkflowLogFilename,
  readDirectoryPermission,
  QuickWorkflowFileWriter,
  waitForTransaction,
  type LogDirectoryRepositoryLike,
} from '../../src/background/log-directory';
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
