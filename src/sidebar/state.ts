import type { ReleaseVariant, ThanksMode } from '../domain/models';

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

const BITRATE_LIMIT_STORAGE_KEY = 'jspider.bitrateLimitMbps';

export interface BitrateLimitStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

function normalizeBitrateLimit(value: unknown): string {
  if (value === '') return '';
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const text = String(value).trim();
  const number = Number(text);
  return text && Number.isFinite(number) && number >= 0 ? text : '';
}

export function createBitrateLimitState(storage: BitrateLimitStorage): {
  load(): Promise<string>;
  save(value: string): Promise<void>;
} {
  let pendingWrite: Promise<void> = Promise.resolve();
  return {
    async load() {
      await pendingWrite;
      const stored = await storage.get(BITRATE_LIMIT_STORAGE_KEY);
      return normalizeBitrateLimit(stored[BITRATE_LIMIT_STORAGE_KEY]);
    },
    save(value) {
      const normalized = normalizeBitrateLimit(value);
      pendingWrite = pendingWrite.then(() => storage.set({
        [BITRATE_LIMIT_STORAGE_KEY]: normalized,
      }));
      return pendingWrite;
    },
  };
}

export function resolveThanksPresentation(mode: ThanksMode | undefined): {
  showUnlock: boolean;
  showSelection: boolean;
  selectionLabel: string;
} {
  return {
    showUnlock: mode === 'unlock-container',
    showSelection: mode !== 'unlock-container',
    selectionLabel: mode === 'validate-selection'
      ? 'Conferma le versioni selezionate'
      : 'Ringrazia le versioni selezionate',
  };
}

export function shouldSubmitSelectionThanks(mode: ThanksMode | undefined): boolean {
  return mode !== 'validate-selection';
}

export function validateUnlockedSelection(
  variants: readonly Pick<ReleaseVariant, 'locked' | 'linksLoaded' | 'links'>[],
): string | null {
  if (!variants.length) return 'Seleziona almeno una versione.';
  return variants.some((variant) => variant.locked || !variant.linksLoaded || !variant.links.length)
    ? 'Una o più versioni selezionate non hanno link disponibili.'
    : null;
}

