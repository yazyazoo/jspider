import { readFile, rm } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { assertReleaseVersion, createReleaseArchive } from './distribution.mjs';

const root = resolve(import.meta.dirname, '..');
const release = resolve(root, 'release');
const packageDocument = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const manifestDocument = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));

assertReleaseVersion(
  process.env.GITHUB_REF_NAME?.trim() || undefined,
  packageDocument.version,
  manifestDocument.version,
);

const output = resolve(release, `jspider-v${packageDocument.version}.zip`);
await rm(release, { recursive: true, force: true });
await createReleaseArchive(resolve(root, 'dist'), output);
console.log(`Created ${basename(output)}`);
