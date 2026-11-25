import type { QuickWorkflowLogDocument } from './quick-workflow-log';
import {
  hasSuccessfulFollowStart,
  parseFollowLogFilename,
  sameFollowChain,
  type FollowSeasonKey,
} from '../domain/follow-season';

const DATABASE_NAME = 'jspider-local-files';
const DATABASE_VERSION = 1;
const STORE_NAME = 'handles';
const DIRECTORY_KEY = 'quick-workflow-log-directory';

type ReadWriteMode = { mode: 'readwrite' };

export interface WritableDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission(options?: ReadWriteMode): Promise<PermissionState>;
  requestPermission(options?: ReadWriteMode): Promise<PermissionState>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}
export interface LogDirectoryRepositoryLike {
  load(): Promise<WritableDirectoryHandle | null>;
}
export interface LogDirectoryStatus {
  configured: boolean;
  name: string | null;
  permission: PermissionState | 'missing' | 'unknown';
}
export interface FollowLogHistory {
  documents: unknown[];
  matchedFiles: number;
  historicalHosts: FollowSeasonKey['hosts'] | null;
}

export async function readDirectoryPermission(
  handle: WritableDirectoryHandle,
): Promise<PermissionState | 'unknown'> {
  try {
    return await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    return 'unknown';
  }
}
function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error ?? new Error('IndexedDB non disponibile.'));
  });
}
export function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    const failed = () => reject(transaction.error ?? new Error('Salvataggio IndexedDB non riuscito.'));
    transaction.onerror = failed;
    transaction.onabort = failed;
  });
}
export class LogDirectoryRepository implements LogDirectoryRepositoryLike {
  constructor(private readonly suppliedFactory?: IDBFactory) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const operation = (this.suppliedFactory ?? indexedDB).open(DATABASE_NAME, DATABASE_VERSION);
      operation.onupgradeneeded = () => {
        if (!operation.result.objectStoreNames.contains(STORE_NAME)) {
          operation.result.createObjectStore(STORE_NAME);
        }
      };
      operation.onsuccess = () => resolve(operation.result);
      operation.onerror = () => reject(operation.error ?? new Error('IndexedDB non disponibile.'));
    });
  }

  async load(): Promise<WritableDirectoryHandle | null> {
    const database = await this.open();
    try {
      const value = await request(database.transaction(STORE_NAME).objectStore(STORE_NAME).get(DIRECTORY_KEY));
      return value && typeof value === 'object' && 'getFileHandle' in value
        ? value as WritableDirectoryHandle : null;
    } finally {
      database.close();
    }
  }

  async save(handle: WritableDirectoryHandle): Promise<void> {
    const database = await this.open();
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const committed = waitForTransaction(transaction);
      await request(transaction.objectStore(STORE_NAME).put(handle, DIRECTORY_KEY));
      await committed;
    } finally {
      database.close();
    }
  }

  async status(): Promise<LogDirectoryStatus> {
    const handle = await this.load();
    if (!handle) return { configured: false, name: null, permission: 'missing' };
    return {
      configured: true,
      name: handle.name,
      permission: await readDirectoryPermission(handle),
    };
  }
}
function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}
export function createWorkflowLogFilename(workflowName: string, startedAt: string): string {
  const safeName = workflowName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .slice(0, 100) || 'Quick_Workflow';
  const date = new Date(startedAt);
  const timestamp = [
    date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate()),
  ].join('-') + '_' + [
    pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds()), pad(date.getMilliseconds(), 3),
  ].join('-');
  return `${timestamp}_${safeName}.json`;
}
export class QuickWorkflowFileWriter {
  constructor(private readonly repository: LogDirectoryRepositoryLike) {}

  async write(document: QuickWorkflowLogDocument): Promise<boolean> {
    const directory = await this.repository.load();
    if (!directory) return false;
    const permission = await readDirectoryPermission(directory);
    if (permission !== 'granted' && permission !== 'unknown') {
      return false;
    }
    const file = await directory.getFileHandle(document.fileName, { create: true });
    const writable = await file.createWritable();
    await writable.write(`${JSON.stringify(document, null, 2)}\n`);
    await writable.close();
    return true;
  }
}

export class FollowLogHistoryReader {
  constructor(private readonly repository: LogDirectoryRepositoryLike) {}

  async read(key: FollowSeasonKey): Promise<FollowLogHistory> {
    const directory = await this.repository.load();
    if (!directory) throw new Error('Configura la cartella log per usare Segui stagione.');
    const permission = await readDirectoryPermission(directory);
    if (permission !== 'granted' && permission !== 'unknown') {
      throw new Error('Permesso alla cartella log non disponibile.');
    }
    if (typeof directory.entries !== 'function') {
      throw new Error('Il browser non consente di leggere la cartella log configurata.');
    }

    const indexed: Array<{ name: string; key: FollowSeasonKey }> = [];
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind !== 'file') continue;
      const parsed = parseFollowLogFilename(name);
      if (parsed && parsed.mediaKind === key.mediaKind && parsed.tmdbId === key.tmdbId
        && parsed.season === key.season) {
        indexed.push({ name, key: parsed });
      }
    }
    indexed.sort((left, right) => left.name.localeCompare(right.name));

    const cache = new Map<string, unknown>();
    const read = async (name: string, required: boolean): Promise<unknown | null> => {
      if (cache.has(name)) return cache.get(name)!;
      try {
        const handle = await directory.getFileHandle(name);
        const file = await handle.getFile();
        const document = JSON.parse(await file.text()) as unknown;
        if (document === null || typeof document !== 'object' || Array.isArray(document)
          || (document as Record<string, unknown>).fileName !== name) {
          throw new Error('filename mismatch');
        }
        cache.set(name, document);
        return document;
      } catch {
        if (required) throw new Error(`Log Segui illeggibile: ${name}`);
        return null;
      }
    };

    let historicalHosts: FollowSeasonKey['hosts'] | null = null;
    for (const candidate of indexed) {
      const document = await read(candidate.name, sameFollowChain(candidate.key, key));
      if (!document) continue;
      try {
        if (hasSuccessfulFollowStart(document)) {
          historicalHosts = candidate.key.hosts;
          break;
        }
      } catch {
        if (sameFollowChain(candidate.key, key)) {
          throw new Error(`Log Segui illeggibile: ${candidate.name}`);
        }
      }
    }

    const exact = indexed.filter((candidate) => sameFollowChain(candidate.key, key));
    const documents: unknown[] = [];
    for (const candidate of exact) {
      documents.push(await read(candidate.name, true));
    }
    return { documents, matchedFiles: exact.length, historicalHosts };
  }
}
