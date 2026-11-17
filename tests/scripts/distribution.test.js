import { afterEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import {
  assertReleaseVersion,
  copyLocalConfigIfPresent,
  createReleaseArchive,
  releaseEntries,
} from '../../scripts/distribution.mjs';

const temporaryRoots = [];

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'jspider-distribution-'));
  temporaryRoots.push(root);
  await mkdir(join(root, 'dist'));
  return root;
}

async function exists(path) {
  try { await access(path); return true; }
  catch { return false; }
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('local distribution configuration', () => {
  it('builds without inventing a local configuration when none exists', async () => {
    const root = await temporaryRoot();
    await writeFile(join(root, 'config.example.json'), '{"token":"PLACEHOLDER"}\n');

    await expect(copyLocalConfigIfPresent(root, join(root, 'dist'))).resolves.toBe(false);
    await expect(exists(join(root, 'dist', 'config.local.json'))).resolves.toBe(false);
  });

  it('copies an existing local configuration byte for byte', async () => {
    const root = await temporaryRoot();
    const contents = '{\r\n  "token": "private-value"\r\n}\r\n';
    await writeFile(join(root, 'config.local.json'), contents);

    await expect(copyLocalConfigIfPresent(root, join(root, 'dist'))).resolves.toBe(true);
    await expect(readFile(join(root, 'dist', 'config.local.json'), 'utf8')).resolves.toBe(contents);
  });
});

describe('release distribution policy', () => {
  it('collects root-relative files while excluding local configuration', async () => {
    const root = await temporaryRoot();
    const dist = join(root, 'dist');
    await mkdir(join(dist, 'nested'));
    await writeFile(join(dist, 'manifest.json'), '{}');
    await writeFile(join(dist, 'config.example.json'), '{}');
    await writeFile(join(dist, 'config.local.json'), '{"secret":true}');
    await writeFile(join(dist, 'nested', 'asset.js'), 'export {};');

    const entries = await releaseEntries(dist);

    expect(entries).toEqual(['config.example.json', 'manifest.json', 'nested/asset.js']);
    expect(entries).not.toContain('config.local.json');
    expect(entries.every((entry) => !entry.startsWith('dist/') && !entry.includes('..'))).toBe(true);
  });

  it('requires package, manifest and optional tag versions to agree', () => {
    expect(() => assertReleaseVersion(undefined, '0.1.0', '0.1.0')).not.toThrow();
    expect(() => assertReleaseVersion('v0.1.0', '0.1.0', '0.1.0')).not.toThrow();
    expect(() => assertReleaseVersion('v0.2.0', '0.1.0', '0.1.0')).toThrow('version');
    expect(() => assertReleaseVersion('v0.1.0', '0.1.0', '0.2.0')).toThrow('version');
  });

  it('creates a root-level ZIP without local configuration', async () => {
    const root = await temporaryRoot();
    const dist = join(root, 'dist');
    const output = join(root, 'release', 'jspider.zip');
    await writeFile(join(dist, 'manifest.json'), '{}');
    await writeFile(join(dist, 'config.example.json'), '{}');
    await writeFile(join(dist, 'config.local.json'), '{"secret":true}');

    await createReleaseArchive(dist, output);

    const archive = unzipSync(new Uint8Array(await readFile(output)));
    expect(Object.keys(archive).sort()).toEqual(['config.example.json', 'manifest.json']);
  });
});

describe('single-repository documentation', () => {
  it('documents release installation, dist development and focused guides', async () => {
    const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8');

    expect(readme).toContain('GitHub Releases');
    expect(readme).toContain('JSpider/dist');
    expect(readme).toContain('[Configuration](docs/configuration.md)');
    expect(readme).toContain('[Development](docs/development.md)');
    expect(readme).toContain('[Architecture](docs/architecture.md)');
    expect(readme).toContain('do not load the repository root');
  });

  it('keeps an Italian document beside every English guide with reciprocal links', async () => {
    const pairs = [
      ['../../README.md', '../../README.it.md'],
      ['../../docs/configuration.md', '../../docs/configuration.it.md'],
      ['../../docs/development.md', '../../docs/development.it.md'],
      ['../../docs/architecture.md', '../../docs/architecture.it.md'],
      ['../../docs/operator-manual.md', '../../docs/operator-manual.it.md'],
    ];

    for (const [englishPath, italianPath] of pairs) {
      const english = await readFile(new URL(englishPath, import.meta.url), 'utf8');
      const italian = await readFile(new URL(italianPath, import.meta.url), 'utf8');
      expect(english).toContain('Italiano');
      expect(italian).toContain('English');
    }
  });

  it('links both operator manuals from the matching README language', async () => {
    const english = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
    const italian = await readFile(new URL('../../README.it.md', import.meta.url), 'utf8');
    expect(english).toContain('[Operator manual](docs/operator-manual.md)');
    expect(italian).toContain('[Manuale operativo](docs/operator-manual.it.md)');
  });
});
