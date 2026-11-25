export interface ProjectFileHandle {
  getFile(): Promise<Pick<File, 'text'>>;
  createWritable(): Promise<{
    write(value: string): Promise<void>;
    close(): Promise<void>;
  }>;
}

export interface ProjectDirectoryHandle {
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<ProjectFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<ProjectDirectoryHandle>;
}

export interface ProjectLogAlignment {
  logHandle: ProjectDirectoryHandle;
  fullPath: string;
  updatedFiles: string[];
}

function normalizePath(value: string): { path: string; parts: string[] } {
  const input = value.trim();
  if (!input) throw new Error('Inserisci il percorso completo della cartella log.');
  if (/\p{Cc}/u.test(input)) throw new Error('Il percorso completo contiene caratteri non validi.');

  if (/^[A-Za-z]:[\\/]/.test(input)) {
    const path = input.replace(/\//g, '\\').replace(/\\+/g, '\\').replace(/\\$/, '');
    return { path, parts: path.slice(3).split('\\').filter(Boolean) };
  }
  if (input.startsWith('/')) {
    const path = input.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    return { path, parts: path.split('/').filter(Boolean) };
  }
  throw new Error('Inserisci il percorso completo assoluto della cartella log.');
}

export function validateProjectLogPath(value: string, projectName: string): string {
  const { path, parts } = normalizePath(value);
  if (parts.at(-1)?.toLocaleLowerCase() !== 'log') {
    throw new Error('Il percorso completo deve terminare con la cartella “log”.');
  }
  if (parts.at(-2)?.toLocaleLowerCase() !== projectName.toLocaleLowerCase()) {
    throw new Error(`Il percorso deve appartenere alla cartella progetto selezionata “${projectName}”.`);
  }
  return path;
}

export function validateExistingLogPath(value: string, directoryName: string): string {
  const { path, parts } = normalizePath(value);
  if (directoryName.toLocaleLowerCase() !== 'log' || parts.at(-1)?.toLocaleLowerCase() !== 'log') {
    throw new Error('La cartella Chromium già autorizzata e il percorso devono terminare con “log”.');
  }
  return path;
}

function isNotFound(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === 'NotFoundError';
}

async function readRootConfig(root: ProjectDirectoryHandle): Promise<{
  handle: ProjectFileHandle;
  value: Record<string, unknown>;
}> {
  let handle: ProjectFileHandle;
  try {
    handle = await root.getFileHandle('config.local.json');
  } catch (reason) {
    if (isNotFound(reason)) {
      throw new Error('CONFIG MANCANTE · config.local.json non esiste nella cartella progetto selezionata.');
    }
    throw reason;
  }

  try {
    const value: unknown = JSON.parse(await (await handle.getFile()).text());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return { handle, value: value as Record<string, unknown> };
  } catch {
    throw new Error('Il config.local.json della root non è un JSON valido.');
  }
}

async function writeJson(handle: ProjectFileHandle, value: Record<string, unknown>): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(`${JSON.stringify(value, null, 2)}\n`);
  await writable.close();
}

export async function alignProjectLogDirectory(
  root: ProjectDirectoryHandle,
  requestedPath: string,
): Promise<ProjectLogAlignment> {
  const fullPath = validateProjectLogPath(requestedPath, root.name);
  const rootConfig = await readRootConfig(root);
  const next = { ...rootConfig.value, _logDirectory: fullPath };

  let distConfig: ProjectFileHandle | null = null;
  try {
    const dist = await root.getDirectoryHandle('dist');
    distConfig = await dist.getFileHandle('config.local.json', { create: true });
  } catch (reason) {
    if (!isNotFound(reason)) throw reason;
  }

  const logHandle = await root.getDirectoryHandle('log', { create: true });
  await writeJson(rootConfig.handle, next);
  const updatedFiles = ['config.local.json'];
  if (distConfig) {
    await writeJson(distConfig, next);
    updatedFiles.push('dist/config.local.json');
  }
  return { logHandle, fullPath, updatedFiles };
}
