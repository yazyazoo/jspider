import { normalizeTaskFlowBaseUrl } from '../domain/taskflow-url';

export interface StoredSettings {
  taskflowBaseUrl: string;
  taskflowToken: string;
  tmdbCredential: string;
  omdbApiKey: string;
  mdblistApiKey: string;
}

export interface SettingsSummary {
  taskflowBaseUrl: string;
  taskflowToken: string;
  tmdbCredential: string;
  omdbApiKey: string;
  mdblistApiKey: string;
  embyBaseUrl: string;
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
  try {
    const response = await fetch(chrome.runtime.getURL(LOCAL_CONFIG_FILE), { cache: 'no-store' });
    if (!response.ok) {
      if (response.status !== 404) {
        console.warn(
          'JSpider: config.local.json ignorato.',
          new Error(`HTTP ${response.status}`),
        );
      }
      return {};
    }
    const value = await response.json();
    if (!isRecord(value)) throw new TypeError('La configurazione locale deve essere un oggetto JSON.');
    return value;
  } catch (reason) {
    console.warn('JSpider: config.local.json ignorato.', reason);
    return {};
  }
}

function normalizeStoredBaseUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_BASE_URL;
  try { return normalizeTaskFlowBaseUrl(value.trim()); }
  catch { return DEFAULT_BASE_URL; }
}

function normalizeStored(value: unknown): StoredSettings {
  const raw = isRecord(value) ? value : {};
  return {
    taskflowBaseUrl: normalizeStoredBaseUrl(raw.taskflowBaseUrl),
    taskflowToken: typeof raw.taskflowToken === 'string' ? raw.taskflowToken : '',
    tmdbCredential: typeof raw.tmdbCredential === 'string' ? raw.tmdbCredential : '',
    omdbApiKey: typeof raw.omdbApiKey === 'string' ? raw.omdbApiKey : '',
    mdblistApiKey: typeof raw.mdblistApiKey === 'string' ? raw.mdblistApiKey : '',
  };
}

export async function loadSettings(): Promise<StoredSettings> {
  const [result, local] = await Promise.all([
    chrome.storage.local.get(STORAGE_KEY),
    loadLocalConfig(),
  ]);
  return normalizeStored({
    ...local,
    ...selectSettings(result[STORAGE_KEY]),
  });
}

export async function loadEmbySettings(): Promise<EmbySettings> {
  const local = await loadLocalConfig();
  return {
    baseUrl: typeof local.embyBaseUrl === 'string' ? local.embyBaseUrl.trim().replace(/\/$/, '') : '',
    token: typeof local.embyToken === 'string' ? local.embyToken.trim() : '',
  };
}

export async function settingsSummary(): Promise<SettingsSummary> {
  const [settings, emby] = await Promise.all([loadSettings(), loadEmbySettings()]);
  return {
    taskflowBaseUrl: settings.taskflowBaseUrl,
    taskflowToken: settings.taskflowToken,
    tmdbCredential: settings.tmdbCredential,
    omdbApiKey: settings.omdbApiKey,
    mdblistApiKey: settings.mdblistApiKey,
    embyBaseUrl: emby.baseUrl,
    taskflowConfigured: Boolean(settings.taskflowToken),
    tmdbConfigured: Boolean(settings.tmdbCredential),
    omdbConfigured: Boolean(settings.omdbApiKey),
    mdblistConfigured: Boolean(settings.mdblistApiKey),
    embyConfigured: Boolean(emby.baseUrl && emby.token),
  };
}

export async function updateSettings(patch: Record<string, unknown>): Promise<SettingsSummary> {
  const current = await loadSettings();
  const next: StoredSettings = {
    taskflowBaseUrl: typeof patch.taskflowBaseUrl === 'string' && patch.taskflowBaseUrl.trim()
      ? normalizeTaskFlowBaseUrl(patch.taskflowBaseUrl.trim()) : current.taskflowBaseUrl,
    taskflowToken: typeof patch.taskflowToken === 'string' ? patch.taskflowToken.trim() : current.taskflowToken,
    tmdbCredential: typeof patch.tmdbCredential === 'string' ? patch.tmdbCredential.trim() : current.tmdbCredential,
    omdbApiKey: typeof patch.omdbApiKey === 'string' ? patch.omdbApiKey.trim() : current.omdbApiKey,
    mdblistApiKey: typeof patch.mdblistApiKey === 'string' ? patch.mdblistApiKey.trim() : current.mdblistApiKey,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  const emby = await loadEmbySettings();
  return {
    taskflowBaseUrl: next.taskflowBaseUrl,
    taskflowToken: next.taskflowToken,
    tmdbCredential: next.tmdbCredential,
    omdbApiKey: next.omdbApiKey,
    mdblistApiKey: next.mdblistApiKey,
    embyBaseUrl: emby.baseUrl,
    taskflowConfigured: Boolean(next.taskflowToken),
    tmdbConfigured: Boolean(next.tmdbCredential),
    omdbConfigured: Boolean(next.omdbApiKey),
    mdblistConfigured: Boolean(next.mdblistApiKey),
    embyConfigured: Boolean(emby.baseUrl && emby.token),
  };
}

