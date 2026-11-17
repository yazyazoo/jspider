import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const bundlePath = resolve('vendor/taskflow-ui/taskflow-ui.es.js');

describe('vendored TaskFlow WebUI contract', () => {
  it('matches the reviewed deployment snapshot', async () => {
    const bundle = await readFile(bundlePath);
    expect(createHash('sha256').update(bundle).digest('hex'))
      .toBe('797a339d0af2d1c64c548bb0eac4f0e8f8c3f422ffd643ce2a2fe58893d82b95');
  });

  it('exposes selectable non-ready packages and the preset transition used by the bridge', async () => {
    const bundle = await readFile(bundlePath, 'utf8');
    expect(bundle).toContain('selectablePackages');
    expect(bundle).toContain('needs_attention');
    expect(bundle).toContain('changePreset');
  });
});
