export function reconcileSelection(
  previous: readonly string[],
  explicitlyAdjusted: boolean,
  available: readonly string[],
  recommended: readonly string[],
): string[] {
  const availableKeys = new Set(available);
  const source = explicitlyAdjusted ? previous : recommended;
  return [...new Set(source.filter((key) => availableKeys.has(key)))];
}

export function applyThankReplacements(
  selected: readonly string[],
  replacements: Readonly<Record<string, readonly string[]>>,
  available: readonly string[],
): string[] {
  const availableKeys = new Set(available);
  return [...new Set(selected.flatMap((key) => replacements[key] ?? [key])
    .filter((key) => availableKeys.has(key)))];
}

export function shouldAutoSearchTmdb(configured: boolean, mediaKind: string): boolean {
  return configured && (mediaKind === 'movie' || mediaKind === 'tv');
}


