import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const bundlePath = resolve('vendor/taskflow-ui/taskflow-ui.es.js');
const versionPath = resolve('vendor/taskflow-ui/version.json');

describe('vendored TaskFlow WebUI contract', () => {
  it('matches the reviewed deployment snapshot', async () => {
    const bundle = await readFile(bundlePath);
    const version = JSON.parse(await readFile(versionPath, 'utf8'));
    expect(createHash('sha256').update(bundle).digest('hex'))
      .toBe(version.sha256);
    expect(version.source).toBe('https://taskflow.redprimrose.mov/ui/taskflow-ui.es.js');
  });

  it('exposes selectable non-ready packages and the preset transition used by the bridge', async () => {
    const bundle = await readFile(bundlePath, 'utf8');
    expect(bundle).toContain('selectablePackages');
    expect(bundle).toContain('needs_attention');
    expect(bundle).toContain('changePreset');
  });
});
