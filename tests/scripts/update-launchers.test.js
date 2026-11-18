import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function optionalFile(path) {
  return readFile(path, 'utf8').catch(() => '');
}

describe('TaskFlow WebUI update launchers', () => {
  it('provides a Windows launcher that resolves the repository and preserves failures', async () => {
    const launcher = await optionalFile('Aggiorna-WebUI.cmd');
    expect(launcher).toContain('cd /d "%~dp0"');
    expect(launcher).toMatch(/where node/i);
    expect(launcher).toMatch(/where npm/i);
    expect(launcher).toContain('npm run update:webui');
    expect(launcher).toMatch(/exit \/b %\w+%/i);
    expect(launcher).toMatch(/pause/i);
  });

  it('provides a macOS launcher that handles paths with spaces and preserves failures', async () => {
    const launcher = await optionalFile('Aggiorna-WebUI.command');
    expect(launcher.startsWith('#!/bin/sh')).toBe(true);
    expect(launcher).toContain('cd -- "$(dirname -- "$0")"');
    expect(launcher).toContain('command -v node');
    expect(launcher).toContain('command -v npm');
    expect(launcher).toContain('npm run update:webui');
    expect(launcher).toMatch(/exit "\$\w+"/);
    expect(launcher).toMatch(/read/);
  });
});
