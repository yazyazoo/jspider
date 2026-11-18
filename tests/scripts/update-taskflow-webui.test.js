import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const updaterUrl = new URL('../../scripts/update-taskflow-webui.mjs', import.meta.url);
const workspaces = [];
const liveUrl = 'https://taskflow.redprimrose.mov/ui/taskflow-ui.es.js';
const oldBundle = 'selectablePackages needs_attention changePreset customElements.define(`taskflow-ui`, Old)';
const candidate = 'selectablePackages needs_attention changePreset customElements.define(`taskflow-ui`, Current)';

async function loadUpdater() {
  return import(updaterUrl.href).catch(() => ({}));
}

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'jspider-webui-update-'));
  workspaces.push(root);
  await mkdir(resolve(root, 'vendor/taskflow-ui'), { recursive: true });
  await writeFile(resolve(root, 'vendor/taskflow-ui/taskflow-ui.es.js'), oldBundle);
  await writeFile(resolve(root, 'vendor/taskflow-ui/version.json'), JSON.stringify({
    source: liveUrl,
    sha256: createHash('sha256').update(oldBundle).digest('hex'),
  }));
  return root;
}

function response(body = candidate) {
  return new Response(body, {
    status: 200,
    headers: {
      ETag: '"current-etag"',
      'Last-Modified': 'Mon, 16 Nov 2026 12:53:25 GMT',
    },
  });
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('TaskFlow WebUI updater', () => {
  it('uses cmd.exe for npm on Windows without enabling Node shell mode', async () => {
    const { commandInvocation } = await loadUpdater();
    expect(commandInvocation).toBeTypeOf('function');
    expect(commandInvocation('npm', ['run', 'check'], 'win32', 'C:\\Windows\\cmd.exe')).toEqual({
      executable: 'C:\\Windows\\cmd.exe',
      args: ['/d', '/s', '/c', 'npm run check'],
    });
    expect(commandInvocation('npm', ['run', 'check'], 'darwin')).toEqual({
      executable: 'npm',
      args: ['run', 'check'],
    });
  });

  it('installs a valid candidate, records its revision, and reports pipeline completion', async () => {
    const { updateTaskFlowWebUi } = await loadUpdater();
    expect(updateTaskFlowWebUi).toBeTypeOf('function');
    const root = await workspace();
    const commands = [];
    const progress = [];

    const metadata = await updateTaskFlowWebUi({
      root,
      fetcher: async () => response(),
      runCommand: async (command, args) => { commands.push([command, ...args].join(' ')); },
      now: () => new Date('2026-11-18T10:00:00.000Z'),
      log: (line) => progress.push(line),
    });

    expect(await readFile(resolve(root, 'vendor/taskflow-ui/taskflow-ui.es.js'), 'utf8'))
      .toBe(candidate);
    expect(metadata).toMatchObject({
      source: liveUrl,
      etag: '"current-etag"',
      lastModified: 'Mon, 16 Nov 2026 12:53:25 GMT',
      syncedAt: '2026-11-18T10:00:00.000Z',
      sha256: createHash('sha256').update(candidate).digest('hex'),
    });
    expect(JSON.parse(await readFile(resolve(root, 'vendor/taskflow-ui/version.json'), 'utf8')))
      .toEqual(metadata);
    expect(commands).toEqual([
      'npm run check',
      'npm test',
      'npm run audit:legacy',
      'npm run build',
    ]);
    expect(progress).toEqual(expect.arrayContaining([
      expect.stringContaining('[10%]'),
      expect.stringContaining('[70%]'),
      expect.stringContaining('[95%]'),
      expect.stringContaining('[100%]'),
    ]));
  });

  it('rejects an incompatible candidate before replacing the current bundle', async () => {
    const { updateTaskFlowWebUi } = await loadUpdater();
    expect(updateTaskFlowWebUi).toBeTypeOf('function');
    const root = await workspace();
    const commands = [];

    await expect(updateTaskFlowWebUi({
      root,
      fetcher: async () => response('console.log("not TaskFlow")'),
      runCommand: async (...parts) => { commands.push(parts); },
      log: () => {},
    })).rejects.toThrow('contratto');

    expect(await readFile(resolve(root, 'vendor/taskflow-ui/taskflow-ui.es.js'), 'utf8'))
      .toBe(oldBundle);
    expect(commands).toEqual([]);
  });

  it('restores the previous bundle and metadata when verification fails', async () => {
    const { updateTaskFlowWebUi } = await loadUpdater();
    expect(updateTaskFlowWebUi).toBeTypeOf('function');
    const root = await workspace();
    const previousMetadata = await readFile(resolve(root, 'vendor/taskflow-ui/version.json'), 'utf8');
    const commands = [];

    await expect(updateTaskFlowWebUi({
      root,
      fetcher: async () => response(),
      runCommand: async (command, args) => {
        const value = [command, ...args].join(' ');
        commands.push(value);
        if (value === 'npm test') throw new Error('test failure');
      },
      log: () => {},
    })).rejects.toThrow('test failure');

    expect(await readFile(resolve(root, 'vendor/taskflow-ui/taskflow-ui.es.js'), 'utf8'))
      .toBe(oldBundle);
    expect(await readFile(resolve(root, 'vendor/taskflow-ui/version.json'), 'utf8'))
      .toBe(previousMetadata);
    expect(commands.at(-1)).toBe('npm run build');
  });

  it('restores the previous bundle when writing candidate metadata fails', async () => {
    const { updateTaskFlowWebUi } = await loadUpdater();
    expect(updateTaskFlowWebUi).toBeTypeOf('function');
    const root = await workspace();
    const previousMetadata = await readFile(resolve(root, 'vendor/taskflow-ui/version.json'), 'utf8');
    let rejectMetadataOnce = true;
    const writeAtomic = async (path, value) => {
      if (path.endsWith('version.json') && rejectMetadataOnce) {
        rejectMetadataOnce = false;
        throw new Error('metadata write failure');
      }
      const temporary = `${path}.test-tmp`;
      await writeFile(temporary, value);
      await rename(temporary, path);
    };

    await expect(updateTaskFlowWebUi({
      root,
      fetcher: async () => response(),
      runCommand: async () => {},
      writeAtomic,
      log: () => {},
    })).rejects.toThrow('metadata write failure');

    expect(await readFile(resolve(root, 'vendor/taskflow-ui/taskflow-ui.es.js'), 'utf8'))
      .toBe(oldBundle);
    expect(await readFile(resolve(root, 'vendor/taskflow-ui/version.json'), 'utf8'))
      .toBe(previousMetadata);
  });
});
