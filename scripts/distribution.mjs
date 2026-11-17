import { access, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';
import { zipSync } from 'fflate';

export const LOCAL_CONFIG_FILE = 'config.local.json';

export async function copyLocalConfigIfPresent(root, output) {
  const source = resolve(root, LOCAL_CONFIG_FILE);
  try {
    await access(source);
  } catch (reason) {
    if (reason && typeof reason === 'object' && reason.code === 'ENOENT') return false;
    throw reason;
  }
  await copyFile(source, resolve(output, LOCAL_CONFIG_FILE));
  return true;
}

export async function releaseEntries(dist) {
  const root = resolve(dist);
  const entries = [];

  async function visit(directory, prefix = '') {
    const children = await readdir(directory, { withFileTypes: true });
    for (const child of children) {
      const relative = prefix ? posix.join(prefix, child.name) : child.name;
      const absolute = resolve(directory, child.name);
      if (child.isSymbolicLink()) throw new Error(`Release archives do not allow symbolic links: ${relative}`);
      if (child.isDirectory()) {
        await visit(absolute, relative);
      } else if (child.isFile() && relative !== LOCAL_CONFIG_FILE) {
        entries.push(relative);
      } else if (!child.isFile()) {
        throw new Error(`Unsupported release entry: ${relative}`);
      }
    }
  }

  await visit(root);
  return entries.sort((left, right) => left.localeCompare(right, 'en'));
}

export function assertReleaseVersion(tag, packageVersion, manifestVersion) {
  if (packageVersion !== manifestVersion) {
    throw new Error(`Release version mismatch: package ${packageVersion}, manifest ${manifestVersion}.`);
  }
  if (tag !== undefined && tag !== `v${packageVersion}`) {
    throw new Error(`Release tag version mismatch: ${tag}, expected v${packageVersion}.`);
  }
}

export async function createReleaseArchive(dist, output) {
  const root = resolve(dist);
  const archive = Object.create(null);
  for (const entry of await releaseEntries(root)) {
    archive[entry] = [
      new Uint8Array(await readFile(resolve(root, ...entry.split('/')))),
      { mtime: new Date('1980-01-01T00:00:00.000Z') },
    ];
  }
  const target = resolve(output);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, zipSync(archive, { level: 9 }));
}
