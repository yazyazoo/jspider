import { describe, expect, it } from 'vitest';
import { resolvePresetCleanup } from '../../src/sidebar/preset-cleanup';

const presets = [
  { code: 'cleanup', defaults: { cleanup_on_success: true } },
  { code: 'keep-files', defaults: { cleanup_on_success: false } },
  { code: 'legacy', defaults: {} },
];

describe('resolvePresetCleanup', () => {
  it('keeps Cleanup enabled when the server default preset is used', () => {
    expect(resolvePresetCleanup('', presets)).toBe(true);
  });

  it('uses the selected preset cleanup default', () => {
    expect(resolvePresetCleanup('cleanup', presets)).toBe(true);
    expect(resolvePresetCleanup('keep-files', presets)).toBe(false);
  });

  it('disables Cleanup when the selected preset does not declare it', () => {
    expect(resolvePresetCleanup('legacy', presets)).toBe(false);
  });
});
