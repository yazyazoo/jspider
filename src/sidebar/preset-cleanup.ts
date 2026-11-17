export interface CleanupPreset {
  code: string;
  defaults?: Readonly<Record<string, unknown>>;
}

export function resolvePresetCleanup(
  presetCode: string,
  presets: readonly CleanupPreset[],
): boolean {
  if (!presetCode) return true;
  const preset = presets.find((candidate) => candidate.code === presetCode);
  return preset?.defaults?.cleanup_on_success === true;
}
