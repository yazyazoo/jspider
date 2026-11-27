import { afterEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import {
  assertReleaseVersion,
  copyLocalConfigIfPresent,
  copyRatingAssets,
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
  it('copies packaged rating logos into the extension assets directory', async () => {
    const root = await temporaryRoot();
    const source = join(root, 'src', 'assets', 'ratings');
    await mkdir(source, { recursive: true });
    await writeFile(join(source, 'imdb.png'), new Uint8Array([1, 2, 3]));

    await copyRatingAssets(root, join(root, 'dist'));

    await expect(readFile(join(root, 'dist', 'assets', 'ratings', 'imdb.png')))
      .resolves.toEqual(Buffer.from([1, 2, 3]));
  });

  it('builds without inventing a local configuration when none exists', async () => {
    const root = await temporaryRoot();
    await writeFile(join(root, 'config.example.json'), '{"token":"PLACEHOLDER"}\n');

    await expect(copyLocalConfigIfPresent(root, join(root, 'dist'))).resolves.toBe(false);
    await expect(exists(join(root, 'dist', 'config.local.json'))).resolves.toBe(false);
  });

  it('packages the top-level log directory authorization page', async () => {
    const buildScript = await readFile(new URL('../../scripts/build.mjs', import.meta.url), 'utf8');
    expect(buildScript).toContain("src/log-directory/index.ts");
    expect(buildScript).toContain("log-directory.html");
    expect(buildScript).toContain("log-directory.css");
  });

  it('builds the distributed manifest from the declarative site catalog', async () => {
    const buildScript = await readFile(new URL('../../scripts/build.mjs', import.meta.url), 'utf8');
    expect(buildScript).toContain('createExtensionManifest');
    expect(buildScript).toContain('src/sites/catalog.json');
    expect(buildScript).not.toContain("copyFile(resolve(root, 'manifest.json')");
    expect(buildScript.indexOf('createExtensionManifest(baseManifest, siteCatalog)'))
      .toBeLessThan(buildScript.indexOf('rm(output'));
  });

  it('publishes an MDBList placeholder without publishing a local key', async () => {
    const example = JSON.parse(await readFile(new URL('../../config.example.json', import.meta.url), 'utf8'));
    expect(example.mdblistApiKey).toBe('INSERISCI_API_KEY_MDBLIST');
    expect(example._logDirectory).toBe('INSERISCI_PERCORSO_COMPLETO_CARTELLA_LOG');
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
      ['../../docs/installation.md', '../../docs/installation.it.md'],
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

  it('publishes a tracked dist folder and exact public distribution links', async () => {
    const ignoreRules = await readFile(new URL('../../.gitignore', import.meta.url), 'utf8');
    const english = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
    const italian = await readFile(new URL('../../README.it.md', import.meta.url), 'utf8');
    const distUrl = 'https://github.com/yazyazoo/jspider/tree/main/dist';
    const zipUrl = 'https://github.com/yazyazoo/jspider/releases/download/v0.1.0/jspider-v0.1.0.zip';

    expect(ignoreRules.split(/\r?\n/)).not.toContain('dist/');
    expect(ignoreRules.split(/\r?\n/)).toContain('config.local.json');
    expect(ignoreRules.split(/\r?\n/)).toContain('log/');
    expect(english).toContain(distUrl);
    expect(english).toContain(zipUrl);
    expect(italian).toContain(distUrl);
    expect(italian).toContain(zipUrl);
  });

  it('documents the selected local JSON log history in both languages', async () => {
    const english = await readFile(new URL('../../docs/configuration.md', import.meta.url), 'utf8');
    const italian = await readFile(new URL('../../docs/configuration.it.md', import.meta.url), 'utf8');
    expect(english).toContain('Quick Workflow log folder');
    expect(italian).toContain('Cartella log Quick Workflow');
  });

  it('makes CI reject a tracked dist folder that is out of sync', async () => {
    const workflow = await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');

    expect(workflow).toContain('git diff --exit-code -- dist');
  });
});
