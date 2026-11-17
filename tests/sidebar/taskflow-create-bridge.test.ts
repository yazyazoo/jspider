import { describe, expect, it } from 'vitest';
import {
  buildTaskFlowSeedData,
  openTaskFlowCreate,
  type TaskFlowCreateRuntime,
} from '../../src/sidebar/taskflow-create-bridge';

function runtime(packageIds = ['pkg-a']): TaskFlowCreateRuntime {
  return {
    view: 'dashboard',
    createState: {
      packageIds: [], taskNames: ['tmdb', 'unrar'], taskJson: '{}',
      workflowName: '', cleanupOnSuccess: false,
    },
    store: { selectablePackages: packageIds.map((id) => ({ id })) },
    configure() {},
    changePreset() { this.createState.taskJson = '{}'; },
    requestUpdate() {},
  };
}

describe('TaskFlow Create seed', () => {
  it('builds the exact shared metadata for validated TMDB and optional RAR password', () => {
    expect(buildTaskFlowSeedData({
      packageIds: ['pkg-a'], workflowName: 'Film_2026', mediaKind: 'movie',
      tmdb: { tmdb_id: 42 }, password: 'rar-secret',
    })).toEqual({
      media_kind: 'movie', tmdb: { tmdb_id: 42 }, unrar: { password: 'rar-secret' },
    });
  });

  it('supports explicit title/year fallback without manufacturing a TMDB id', () => {
    expect(buildTaskFlowSeedData({
      packageIds: ['pkg-a'], workflowName: 'Film_2026', mediaKind: 'movie',
      tmdb: { title: 'Film', year: 2026 }, password: '',
    })).toEqual({ media_kind: 'movie', tmdb: { title: 'Film', year: 2026 } });
  });

  it('opens Create and applies selectable package IDs, including non-ready states', async () => {
    const ui = runtime();
    let configured = false;
    let updated = false;
    ui.configure = () => { configured = true; };
    ui.requestUpdate = () => { updated = true; };

    await openTaskFlowCreate(ui, {
      packageIds: ['pkg-a'], workflowName: 'Film_2026', mediaKind: 'movie',
      tmdb: { tmdb_id: 42 }, password: 'rar-secret',
    }, { apiUrl: 'https://taskflow.test', getAccessToken: async () => 'token', theme: 'dark' });

    expect(configured).toBe(true);
    expect(ui.view).toBe('create');
    expect(ui.createState.packageIds).toEqual(['pkg-a']);
    expect(ui.createState.workflowName).toBe('Film_2026');
    expect(JSON.parse(ui.createState.taskJson)).toEqual({
      media_kind: 'movie', tmdb: { tmdb_id: 42 }, unrar: { password: 'rar-secret' },
    });
    expect(updated).toBe(true);

    ui.changePreset('movie-standard');
    expect(JSON.parse(ui.createState.taskJson)).toEqual({
      media_kind: 'movie', tmdb: { tmdb_id: 42 }, unrar: { password: 'rar-secret' },
    });
  });

  it('fails visibly when a submitted package is absent from the refreshed WebUI catalog', async () => {
    const ui = runtime(['other']);
    await expect(openTaskFlowCreate(ui, {
      packageIds: ['pkg-a'], workflowName: 'Film_2026', mediaKind: 'movie',
      tmdb: { tmdb_id: 42 }, password: '',
    }, {}, async () => undefined)).rejects.toThrow('pkg-a');
    expect(ui.createState.packageIds).toEqual([]);
  });

  it('reports an incompatible stale WebUI instead of silently dropping the seed', async () => {
    const ui = runtime();
    ui.store = { readyPackages: [{ id: 'pkg-a' }] } as never;
    await expect(openTaskFlowCreate(ui, {
      packageIds: ['pkg-a'], workflowName: 'Film_2026', mediaKind: 'movie',
      tmdb: { tmdb_id: 42 }, password: '',
    }, {}, async () => undefined)).rejects.toThrow('WebUI TaskFlow incompatibile');
  });
});

