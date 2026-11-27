import { build } from 'esbuild';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { copyLocalConfigIfPresent, copyRatingAssets } from './distribution.mjs';
import { createExtensionManifest } from './site-manifest.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');
const baseManifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
const siteCatalog = JSON.parse(await readFile(resolve(root, 'src/sites/catalog.json'), 'utf8'));
const extensionManifest = createExtensionManifest(baseManifest, siteCatalog);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

await Promise.all([
  build({
    entryPoints: [resolve(root, 'src/workflow-runner/index.ts')],
    outfile: resolve(output, 'workflow-runner.js'), bundle: true, format: 'esm',
    platform: 'browser', target: 'chrome120', sourcemap: false,
  }),
  build({
    entryPoints: [resolve(root, 'src/background/index.ts')],
    outfile: resolve(output, 'background.js'), bundle: true, format: 'esm',
    platform: 'browser', target: 'chrome120', sourcemap: false,
  }),
  build({
    entryPoints: [resolve(root, 'src/content/index.ts')],
    outfile: resolve(output, 'content.js'), bundle: true, format: 'iife',
    platform: 'browser', target: 'chrome120', sourcemap: false,
  }),
  build({
    entryPoints: [resolve(root, 'src/sidebar/index.ts')],
    outfile: resolve(output, 'sidebar.js'), bundle: true, format: 'esm',
    platform: 'browser', target: 'chrome120', sourcemap: false,
  }),
  build({
    entryPoints: [resolve(root, 'src/log-directory/index.ts')],
    outfile: resolve(output, 'log-directory.js'), bundle: true, format: 'esm',
    platform: 'browser', target: 'chrome120', sourcemap: false,
  }),
]);

await Promise.all([
  copyFile(resolve(root, 'src/workflow-runner/workflow-runner.html'), resolve(output, 'workflow-runner.html')),
  writeFile(resolve(output, 'manifest.json'), `${JSON.stringify(extensionManifest, null, 2)}\n`),
  copyFile(resolve(root, 'config.example.json'), resolve(output, 'config.example.json')),
  copyFile(resolve(root, 'src/sidebar/sidebar.html'), resolve(output, 'sidebar.html')),
  copyFile(resolve(root, 'src/sidebar/sidebar.css'), resolve(output, 'sidebar.css')),
  copyFile(resolve(root, 'src/log-directory/log-directory.html'), resolve(output, 'log-directory.html')),
  copyFile(resolve(root, 'src/log-directory/log-directory.css'), resolve(output, 'log-directory.css')),
  copyFile(resolve(root, 'vendor/taskflow-ui/taskflow-ui.es.js'), resolve(output, 'taskflow-ui.es.js')),
  copyFile(resolve(root, 'vendor/taskflow-ui/version.json'), resolve(output, 'taskflow-ui-version.json')),
  copyFile(resolve(root, 'vendor/taskflow-ui/LICENSE'), resolve(output, 'TASKFLOW-WEBUI-LICENSE')),
  copyFile(resolve(root, 'LICENSE'), resolve(output, 'LICENSE')),
  copyFile(resolve(root, 'NOTICE'), resolve(output, 'NOTICE')),
]);

await copyRatingAssets(root, output);
await copyLocalConfigIfPresent(root, output);

