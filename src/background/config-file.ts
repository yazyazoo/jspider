export interface WritableConfigFile extends FileSystemFileHandle {
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Archivio file non disponibile.'));
  });
}

export class ConfigFileRepository {
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('jspider-config-file', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('handles');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Archivio file non disponibile.'));
    });
  }

  async load(): Promise<WritableConfigFile | null> {
    if (typeof indexedDB === 'undefined') return null;
    const db = await this.open();
    try { return (await result(db.transaction('handles').objectStore('handles').get('config'))) ?? null; }
    finally { db.close(); }
  }

  async save(handle: WritableConfigFile): Promise<void> {
    const db = await this.open();
    try {
      const transaction = db.transaction('handles', 'readwrite');
      const done = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error('Collegamento file non salvato.'));
      });
      await result(transaction.objectStore('handles').put(handle, 'config'));
      await done;
    } finally { db.close(); }
  }
}

export function parseLocalConfig(text: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new Error('config.local.json non è un JSON valido. Correggi il file prima di continuare.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('config.local.json deve contenere un oggetto JSON.');
  }
  return value as Record<string, unknown>;
}

export async function linkConfigFile(handle: WritableConfigFile): Promise<void> {
  if (handle.name !== 'config.local.json') throw new Error('Seleziona il file config.local.json.');
  const permission = await handle.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') throw new Error('Permesso di scrittura sul file non concesso.');
  parseLocalConfig(await (await handle.getFile()).text());
  await new ConfigFileRepository().save(handle);
  await chrome.storage.local.set({ 'jspider.configFileRevision': Date.now() });
}
