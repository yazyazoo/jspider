import { normalizeTaskFlowBaseUrl } from '../domain/taskflow-url';
import { ConfigFileRepository, parseLocalConfig } from './config-file';

export interface StoredSettings {
  protectedExecution: boolean;
  taskflowBaseUrl: string;
  taskflowToken: string;
  tmdbCredential: string;
  omdbApiKey: string;
  mdblistApiKey: string;
}

export interface SettingsSummary {
  protectedExecution: boolean;
  configFileLinked: boolean;
  taskflowBaseUrl: string;
  taskflowToken: string;
  tmdbCredential: string;
  omdbApiKey: string;
  mdblistApiKey: string;
  embyBaseUrl: string;
  embyToken: string;
  logDirectoryConfig: string;
  taskflowConfigured: boolean;
  tmdbConfigured: boolean;
  omdbConfigured: boolean;
  mdblistConfigured: boolean;
  embyConfigured: boolean;
}

export interface EmbySettings {
  baseUrl: string;
  token: string;
}

const STORAGE_KEY = 'jspider.settings';
const DEFAULT_BASE_URL = 'https://taskflow.redprimrose.mov';
const LOCAL_CONFIG_FILE = 'config.local.json';
const SETTINGS_KEYS = [
  'protectedExecution',
  'taskflowBaseUrl',
  'taskflowToken',
  'tmdbCredential',
  'omdbApiKey',
  'mdblistApiKey',
] as const satisfies readonly (keyof StoredSettings)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function selectSettings(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(SETTINGS_KEYS
    .filter((key) => Object.prototype.hasOwnProperty.call(value, key))
    .map((key) => [key, value[key]]));
}

async function loadLocalConfig(): Promise<Record<string, unknown>> {
  const handle = await new ConfigFileRepository().load();
  if (handle) {
    try { return parseLocalConfig(await (await handle.getFile()).text()); }
    catch (reason) {
      if (reason instanceof DOMException) {
        throw new Error('File config non accessibile. Riautorizza config.local.json nelle impostazioni.');
      }
      throw reason;
    }
  }
  const response = await fetch(chrome.runtime.getURL(LOCAL_CONFIG_FILE), { cache: 'no-store' });
  if (response.status === 404) return {};
  if (!response.ok) throw new Error(`Lettura config.local.json: HTTP ${response.status}.`);
  const value: unknown = await response.json();
  if (!isRecord(value)) throw new Error('config.local.json deve contenere un oggetto JSON.');
  return value;
}

function normalizeStoredBaseUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_BASE_URL;
  try { return normalizeTaskFlowBaseUrl(value.trim()); }
  catch { return DEFAULT_BASE_URL; }
}

function normalizeStored(value: unknown): StoredSettings {
  const raw = isRecord(value) ? value : {};
  return {
    protectedExecution: typeof raw.protectedExecution === 'boolean' ? raw.protectedExecution : true,
    taskflowBaseUrl: normalizeStoredBaseUrl(raw.taskflowBaseUrl),
    taskflowToken: typeof raw.taskflowToken === 'string' ? raw.taskflowToken : '',
    tmdbCredential: typeof raw.tmdbCredential === 'string' ? raw.tmdbCredential : '',
    omdbApiKey: typeof raw.omdbApiKey === 'string' ? raw.omdbApiKey : '',
    mdblistApiKey: typeof raw.mdblistApiKey === 'string' ? raw.mdblistApiKey : '',
  };
}

export async function loadSettings(): Promise<StoredSettings> {
  const local = await loadLocalConfig();
  const settings = normalizeStored(selectSettings(local));
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...local, ...settings } });
  return settings;
}

export async function loadEmbySettings(): Promise<EmbySettings> {
  const local = await loadLocalConfig();
  return {
    baseUrl: typeof local.embyBaseUrl === 'string' ? local.embyBaseUrl.trim().replace(/\/$/, '') : '',
    token: typeof local.embyToken === 'string' ? local.embyToken.trim() : '',
  };
}

export async function settingsSummary(): Promise<SettingsSummary> {
  const local = await loadLocalConfig();
  const settings = normalizeStored(local);
  const emby = {
    baseUrl: typeof local.embyBaseUrl === 'string' ? local.embyBaseUrl.trim().replace(/\/$/, '') : '',
    token: typeof local.embyToken === 'string' ? local.embyToken.trim() : '',
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...local, ...settings } });
  return {
    protectedExecution: settings.protectedExecution,
    configFileLinked: Boolean(await new ConfigFileRepository().load()),
    taskflowBaseUrl: settings.taskflowBaseUrl,
    taskflowToken: settings.taskflowToken,
    tmdbCredential: settings.tmdbCredential,
    omdbApiKey: settings.omdbApiKey,
    mdblistApiKey: settings.mdblistApiKey,
    embyBaseUrl: emby.baseUrl,
    embyToken: emby.token,
    logDirectoryConfig: typeof local._logDirectory === 'string'
      ? local._logDirectory.trim() : '',
    taskflowConfigured: Boolean(settings.taskflowToken),
    tmdbConfigured: Boolean(settings.tmdbCredential),
    omdbConfigured: Boolean(settings.omdbApiKey),
    mdblistConfigured: Boolean(settings.mdblistApiKey),
    embyConfigured: Boolean(emby.baseUrl && emby.token),
  };
}

async function saveSettingsFile(patch: Record<string, unknown>): Promise<SettingsSummary> {
  const handle = await new ConfigFileRepository().load();
  if (!handle) throw new Error('Collega config.local.json nelle impostazioni prima di salvare. Nessun valore è stato modificato.');
  const local = parseLocalConfig(await (await handle.getFile()).text());
  const current = normalizeStored(local);
  const next: StoredSettings = {
    protectedExecution: typeof patch.protectedExecution === 'boolean'
      ? patch.protectedExecution : current.protectedExecution,
    taskflowBaseUrl: typeof patch.taskflowBaseUrl === 'string' && patch.taskflowBaseUrl.trim()
      ? normalizeTaskFlowBaseUrl(patch.taskflowBaseUrl.trim()) : current.taskflowBaseUrl,
    taskflowToken: typeof patch.taskflowToken === 'string' ? patch.taskflowToken.trim() : current.taskflowToken,
    tmdbCredential: typeof patch.tmdbCredential === 'string' ? patch.tmdbCredential.trim() : current.tmdbCredential,
    omdbApiKey: typeof patch.omdbApiKey === 'string' ? patch.omdbApiKey.trim() : current.omdbApiKey,
    mdblistApiKey: typeof patch.mdblistApiKey === 'string' ? patch.mdblistApiKey.trim() : current.mdblistApiKey,
  };
  const document: Record<string, unknown> = { ...local, ...next };
  for (const key of ['embyBaseUrl', 'embyToken', '_logDirectory']) {
    if (typeof patch[key] === 'string') document[key] = patch[key].trim();
  }
  try {
    const writable = await handle.createWritable();
    await writable.write(`${JSON.stringify(document, null, 2)}\n`);
    await writable.close();
  } catch {
    throw new Error('Salvataggio del file non riuscito. Riautorizza config.local.json; Chromium non è stato aggiornato.');
  }
  return settingsSummary();
}

export async function updateSettings(patch: Record<string, unknown>): Promise<SettingsSummary> {
  const save = () => saveSettingsFile(patch);
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('jspider-config-settings', save) : save();
}

