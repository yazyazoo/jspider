import type { QuickWorkflowLogDocument } from './quick-workflow-log';

const DATABASE_NAME = 'jspider-local-files';
const DATABASE_VERSION = 1;
const STORE_NAME = 'handles';
const DIRECTORY_KEY = 'quick-workflow-log-directory';

type ReadWriteMode = { mode: 'readwrite' };

export interface WritableDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission(options?: ReadWriteMode): Promise<PermissionState>;
  requestPermission(options?: ReadWriteMode): Promise<PermissionState>;
}
export interface LogDirectoryRepositoryLike {
  load(): Promise<WritableDirectoryHandle | null>;
}
export interface LogDirectoryStatus {
  configured: boolean;
  name: string | null;
  permission: PermissionState | 'missing' | 'unknown';
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
