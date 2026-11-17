import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadEmbySettings,
  loadSettings,
  settingsSummary,
  updateSettings,
} from '../../src/background/settings';

const STORAGE_KEY = 'jspider.settings';
let storage: Record<string, unknown>;
let localConfig: unknown;
let localConfigReadError: Error | null;

beforeEach(() => {
  storage = {};
  localConfig = undefined;
  localConfigReadError = null;
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
        async get(key: string) {
          return { [key]: storage[key] };
        },
        async set(values: Record<string, unknown>) {
          Object.assign(storage, values);
        },
      },
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('visible extension settings', () => {
  it('bootstraps every missing setting from config.local.json', async () => {
    localConfig = {
      taskflowBaseUrl: 'https://taskflow.local',
      taskflowToken: 'local-taskflow',
      tmdbCredential: 'local-tmdb',
      omdbApiKey: 'local-omdb',
    };

    await expect(loadSettings()).resolves.toEqual({
      taskflowBaseUrl: 'https://taskflow.local',
      taskflowToken: 'local-taskflow',
      tmdbCredential: 'local-tmdb',
      omdbApiKey: 'local-omdb',
    });
    expect(fetch).toHaveBeenCalledWith(
      'chrome-extension://jspider/config.local.json',
      { cache: 'no-store' },
    );
  });

  it('lets saved properties override local defaults, including an explicit empty value', async () => {
    localConfig = {
      taskflowBaseUrl: 'https://taskflow.local',
      taskflowToken: 'local-taskflow',
      tmdbCredential: 'local-tmdb',
      omdbApiKey: 'local-omdb',
    };
    storage[STORAGE_KEY] = {
      taskflowToken: '',
      tmdbCredential: 'saved-tmdb',
    };

    await expect(loadSettings()).resolves.toEqual({
      taskflowBaseUrl: 'https://taskflow.local',
      taskflowToken: '',
      tmdbCredential: 'saved-tmdb',
      omdbApiKey: 'local-omdb',
    });
  });

  it('keeps saved settings usable when the local JSON is malformed', async () => {
    localConfig = {};
    localConfigReadError = new SyntaxError('Unexpected token');
    storage[STORAGE_KEY] = {
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'saved-taskflow',
      tmdbCredential: 'saved-tmdb',
      omdbApiKey: 'saved-omdb',
    };
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(loadSettings()).resolves.toEqual({
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'saved-taskflow',
      tmdbCredential: 'saved-tmdb',
      omdbApiKey: 'saved-omdb',
    });
    expect(warning).toHaveBeenCalledWith(
      'JSpider: config.local.json ignorato.',
      expect.any(SyntaxError),
    );
  });

  it('migrates an existing record without an OMDb key', async () => {
    storage[STORAGE_KEY] = {
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'taskflow-secret',
      tmdbCredential: 'tmdb-secret',
    };

    await expect(loadSettings()).resolves.toEqual({
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'taskflow-secret',
      tmdbCredential: 'tmdb-secret',
      omdbApiKey: '',
    });
  });

  it('returns every saved value in clear with its configuration state', async () => {
    localConfig = {
      embyBaseUrl: 'http://emby.example:8096',
      embyToken: 'emby-secret',
    };
    storage[STORAGE_KEY] = {
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'taskflow-secret',
      tmdbCredential: 'tmdb-secret',
      omdbApiKey: 'omdb-secret',
    };

    await expect(settingsSummary()).resolves.toEqual({
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'taskflow-secret',
      tmdbCredential: 'tmdb-secret',
      omdbApiKey: 'omdb-secret',
      embyBaseUrl: 'http://emby.example:8096',
      taskflowConfigured: true,
      tmdbConfigured: true,
      omdbConfigured: true,
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
    };

    const result = await updateSettings({
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: '',
      tmdbCredential: '',
      omdbApiKey: 'new-omdb',
    });

    expect(storage[STORAGE_KEY]).toEqual({
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: '',
      tmdbCredential: '',
      omdbApiKey: 'new-omdb',
    });
    expect(result).toEqual({
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: '',
      tmdbCredential: '',
      omdbApiKey: 'new-omdb',
      embyBaseUrl: '',
      taskflowConfigured: false,
      tmdbConfigured: false,
      omdbConfigured: true,
      embyConfigured: false,
    });
  });
});
