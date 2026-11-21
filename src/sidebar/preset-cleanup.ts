export interface CleanupPreset {
  code: string;
  defaults?: Readonly<Record<string, unknown>>;
}

const DEFAULT_QUICK_WORKFLOW_PRESET = 'default-with-cleanup';

export function resolvePresetSelection(
  previousCode: string,
  presets: readonly CleanupPreset[],
): string {
  if (previousCode && presets.some((preset) => preset.code === previousCode)) return previousCode;
  return presets.some((preset) => preset.code === DEFAULT_QUICK_WORKFLOW_PRESET)
    ? DEFAULT_QUICK_WORKFLOW_PRESET : '';
}

export function resolvePresetCleanup(
  presetCode: string,
  presets: readonly CleanupPreset[],
): boolean {
  if (!presetCode) return true;
  const preset = presets.find((candidate) => candidate.code === presetCode);
  return preset?.defaults?.cleanup_on_success === true;
}
