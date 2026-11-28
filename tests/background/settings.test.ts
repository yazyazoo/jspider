import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadEmbySettings,
  loadSettings,
  settingsSummary,
  updateSettings,
} from '../../src/background/settings';
import { ConfigFileRepository, type WritableConfigFile } from '../../src/background/config-file';

const STORAGE_KEY = 'jspider.settings';
let storage: Record<string, unknown>;
let localConfig: unknown;
let localConfigReadError: Error | null;
let configHandle: WritableConfigFile | null;
let writeFailure: boolean;

beforeEach(() => {
  storage = {};
  localConfig = {};
  localConfigReadError = null;
  writeFailure = false;
  configHandle = {
    name: 'config.local.json',
    async getFile() {
      if (localConfigReadError) throw localConfigReadError;
      return { text: async () => JSON.stringify(localConfig) };
    },
    async createWritable() {
      let text = '';
      return {
        async write(value: string) { text = value; },
        async close() {
          if (writeFailure) throw new DOMException('denied', 'NotAllowedError');
          localConfig = JSON.parse(text);
        },
      };
    },
  } as unknown as WritableConfigFile;
  vi.spyOn(ConfigFileRepository.prototype, 'load').mockImplementation(async () => configHandle);
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: localConfig !== undefined,
    status: localConfig === undefined ? 404 : 200,
    async json() {
      if (localConfigReadError) throw localConfigReadError;
      return localConfig;
    },
  }) as Response));
  vi.stubGlobal('chrome', {
    runtime: {
      getURL(path: string) {
        return `chrome-extension://jspider/${path}`;
      },
    },
    storage: {
      local: {
        get: vi.fn(async (key: string) => {
          return { [key]: storage[key] };
        }),
        async set(values: Record<string, unknown>) {
          Object.assign(storage, values);
        },
      },
    },
  });
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('visible extension settings', () => {
  it('defaults protected execution to true and remembers an explicit false from the UI', async () => {
    await expect(settingsSummary()).resolves.toMatchObject({ protectedExecution: true });
    await expect(updateSettings({ protectedExecution: false }))
      .resolves.toMatchObject({ protectedExecution: false });
    await expect(settingsSummary()).resolves.toMatchObject({ protectedExecution: false });
  });

  it('reads the file mode and writes UI changes back to that file and Chromium', async () => {
    localConfig = { protectedExecution: false };
    storage[STORAGE_KEY] = { protectedExecution: true };
    await expect(settingsSummary()).resolves.toMatchObject({ protectedExecution: false });
    await expect(updateSettings({ protectedExecution: true }))
      .resolves.toMatchObject({ protectedExecution: true, configFileLinked: true });
    expect(localConfig).toMatchObject({ protectedExecution: true });
    expect(storage[STORAGE_KEY]).toMatchObject({ protectedExecution: true });
  });

  it('bootstraps every missing setting from config.local.json', async () => {
    configHandle = null;
    localConfig = {
      taskflowBaseUrl: 'https://taskflow.local',
      taskflowToken: 'local-taskflow',
      tmdbCredential: 'local-tmdb',
      omdbApiKey: 'local-omdb',
      mdblistApiKey: 'local-mdblist',
    };

    await expect(loadSettings()).resolves.toEqual({
      protectedExecution: true,
      taskflowBaseUrl: 'https://taskflow.local',
      taskflowToken: 'local-taskflow',
      tmdbCredential: 'local-tmdb',
      omdbApiKey: 'local-omdb',
      mdblistApiKey: 'local-mdblist',
    });
    expect(fetch).toHaveBeenCalledWith(
      'chrome-extension://jspider/config.local.json',
      { cache: 'no-store' },
    );
  });

  it('lets explicit local properties override and synchronize saved values', async () => {
    localConfig = {
      taskflowBaseUrl: 'https://taskflow.local',
      taskflowToken: 'local-taskflow',
      tmdbCredential: 'local-tmdb',
      omdbApiKey: 'local-omdb',
      mdblistApiKey: 'local-mdblist',
    };
    storage[STORAGE_KEY] = {
      taskflowToken: '',
      tmdbCredential: 'saved-tmdb',
      mdblistApiKey: 'saved-mdblist',
    };

    await expect(loadSettings()).resolves.toEqual({
      protectedExecution: true,
      taskflowBaseUrl: 'https://taskflow.local',
      taskflowToken: 'local-taskflow',
      tmdbCredential: 'local-tmdb',
      omdbApiKey: 'local-omdb',
      mdblistApiKey: 'local-mdblist',
    });
    expect(storage[STORAGE_KEY]).toEqual({
      protectedExecution: true,
      taskflowBaseUrl: 'https://taskflow.local',
      taskflowToken: 'local-taskflow',
      tmdbCredential: 'local-tmdb',
      omdbApiKey: 'local-omdb',
      mdblistApiKey: 'local-mdblist',
    });
  });

  it('treats an explicit empty local value as authoritative', async () => {
    localConfig = { mdblistApiKey: '' };
    storage[STORAGE_KEY] = {
      taskflowBaseUrl: 'https://taskflow.example',
      mdblistApiKey: 'saved-mdblist',
    };

    await expect(loadSettings()).resolves.toMatchObject({ mdblistApiKey: '' });
    expect(storage[STORAGE_KEY]).toMatchObject({ mdblistApiKey: '' });
  });

  it('reports malformed JSON without falling back to Chromium values', async () => {
    localConfig = {};
    localConfigReadError = new SyntaxError('Unexpected token');
    storage[STORAGE_KEY] = {
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'saved-taskflow',
      tmdbCredential: 'saved-tmdb',
      omdbApiKey: 'saved-omdb',
      mdblistApiKey: 'saved-mdblist',
    };
    await expect(loadSettings()).rejects.toThrow('Unexpected token');
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  it('fills defaults for a config without OMDb and MDBList keys', async () => {
    localConfig = {
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'taskflow-secret',
      tmdbCredential: 'tmdb-secret',
    };

    await expect(loadSettings()).resolves.toEqual({
      protectedExecution: true,
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'taskflow-secret',
      tmdbCredential: 'tmdb-secret',
      omdbApiKey: '',
      mdblistApiKey: '',
    });
  });

  it('returns every saved value in clear with its configuration state', async () => {
    localConfig = {
      embyBaseUrl: 'http://emby.example:8096',
      embyToken: 'emby-secret',
      _logDirectory: 'C:\\Media\\JSpider\\log',
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'taskflow-secret',
      tmdbCredential: 'tmdb-secret',
      omdbApiKey: 'omdb-secret',
      mdblistApiKey: 'mdblist-secret',
    };
    storage[STORAGE_KEY] = {
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'taskflow-secret',
      tmdbCredential: 'tmdb-secret',
      omdbApiKey: 'omdb-secret',
      mdblistApiKey: 'mdblist-secret',
    };

    await expect(settingsSummary()).resolves.toEqual({
      protectedExecution: true,
      configFileLinked: true,
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'taskflow-secret',
      tmdbCredential: 'tmdb-secret',
      omdbApiKey: 'omdb-secret',
      mdblistApiKey: 'mdblist-secret',
      embyBaseUrl: 'http://emby.example:8096',
      embyToken: 'emby-secret',
      logDirectoryConfig: 'C:\\Media\\JSpider\\log',
      taskflowConfigured: true,
      tmdbConfigured: true,
      omdbConfigured: true,
      mdblistConfigured: true,
      embyConfigured: true,
    });
  });

  it('loads Emby only from the ignored local configuration', async () => {
    localConfig = {
      embyBaseUrl: 'http://emby.example:8096/',
      embyToken: 'emby-secret',
    };
    storage[STORAGE_KEY] = {
      embyBaseUrl: 'https://must-not-win.example',
      embyToken: 'must-not-win',
    };

    await expect(loadEmbySettings()).resolves.toEqual({
      baseUrl: 'http://emby.example:8096',
      token: 'emby-secret',
    });
  });

  it('persists OMDb and treats empty visible fields as explicit deletion', async () => {
    storage[STORAGE_KEY] = {
      taskflowBaseUrl: 'https://old.example',
      taskflowToken: 'old-taskflow',
      tmdbCredential: 'old-tmdb',
      omdbApiKey: 'old-omdb',
      mdblistApiKey: 'old-mdblist',
    };

    const result = await updateSettings({
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: '',
      tmdbCredential: '',
      omdbApiKey: 'new-omdb',
      mdblistApiKey: 'new-mdblist',
    });

    expect(storage[STORAGE_KEY]).toEqual({
      protectedExecution: true,
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: '',
      tmdbCredential: '',
      omdbApiKey: 'new-omdb',
      mdblistApiKey: 'new-mdblist',
    });
    expect(result).toEqual({
      protectedExecution: true,
      configFileLinked: true,
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: '',
      tmdbCredential: '',
      omdbApiKey: 'new-omdb',
      mdblistApiKey: 'new-mdblist',
      embyBaseUrl: '',
      embyToken: '',
      logDirectoryConfig: '',
      taskflowConfigured: false,
      tmdbConfigured: false,
      omdbConfigured: true,
      mdblistConfigured: true,
      embyConfigured: false,
    });
  });

  it('updates config-backed values from the UI and observes later external edits', async () => {
    localConfig = { mdblistApiKey: 'local-mdblist' };
    storage[STORAGE_KEY] = {
      taskflowBaseUrl: 'https://taskflow.example', mdblistApiKey: 'saved-mdblist',
    };

    const result = await updateSettings({ mdblistApiKey: 'ui-mdblist' });

    expect(result.mdblistApiKey).toBe('ui-mdblist');
    expect(localConfig).toMatchObject({ mdblistApiKey: 'ui-mdblist' });
    expect(storage[STORAGE_KEY]).toMatchObject({ mdblistApiKey: 'ui-mdblist' });
    localConfig = { ...(localConfig as Record<string, unknown>), mdblistApiKey: 'external-edit' };
    await expect(loadSettings()).resolves.toMatchObject({ mdblistApiKey: 'external-edit' });
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  it('preserves unknown config fields and saves Emby and log path before mirroring Chromium', async () => {
    localConfig = { future: { keep: true }, embyToken: 'old' };
    await updateSettings({ embyBaseUrl: 'https://emby.example', embyToken: 'new', _logDirectory: '/work/JSpider/log' });
    expect(localConfig).toMatchObject({ future: { keep: true }, embyToken: 'new', _logDirectory: '/work/JSpider/log' });
    expect(storage[STORAGE_KEY]).toEqual(localConfig);
  });

  it('does not update Chromium when the file write fails', async () => {
    localConfig = { mdblistApiKey: 'original' };
    storage[STORAGE_KEY] = { mdblistApiKey: 'original' };
    writeFailure = true;
    await expect(updateSettings({ mdblistApiKey: 'unsaved' })).rejects.toThrow('Chromium non è stato aggiornato');
    expect(storage[STORAGE_KEY]).toEqual({ mdblistApiKey: 'original' });
    expect(localConfig).toEqual({ mdblistApiKey: 'original' });
  });

  it('requires an explicit file link for saving and never uses Chromium as a settings source', async () => {
    configHandle = null;
    localConfig = {};
    storage[STORAGE_KEY] = { taskflowToken: 'stale' };
    await expect(updateSettings({ taskflowToken: 'new' })).rejects.toThrow('Collega config.local.json');
    await expect(loadSettings()).resolves.toMatchObject({ taskflowToken: '' });
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });
});
