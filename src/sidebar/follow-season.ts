import type { LogDirectoryStatus } from '../background/log-directory';
import type { ArchiveHost } from '../domain/archive-links';
import type { CreateMode } from '../domain/create-mode';
import type { ReleaseVariant } from '../domain/models';
import type { WorkflowMetadata } from '../domain/taskflow-contract';

export interface FollowAvailabilityInput {
  metadata: WorkflowMetadata | null;
  variants: readonly Pick<ReleaseVariant, 'season'>[];
  hosts: readonly ArchiveHost[];
  createMode: CreateMode;
  autodownload: boolean;
  logStatus: LogDirectoryStatus;
}

export type FollowAvailability = {
  available: true;
  season: number;
} | {
  available: false;
  reason: string;
};

export interface FollowPreparationResponse {
  variants: ReleaseVariant[];
  currentCount: number;
  processedCount: number;
  newCount: number;
  matchedFiles: number;
  historicalHosts: ArchiveHost[] | null;
}

export interface FollowPreparationState {
  pending: boolean;
  result: FollowPreparationResponse | null;
  error: string | null;
}

export interface FollowPresentationInput {
  enabled: boolean;
  availability: FollowAvailability;
  preparation: FollowPreparationState;
  hosts: readonly ArchiveHost[];
}

export interface FollowPresentation {
  text: string;
  blocking: boolean;
  tone: 'idle' | 'active' | 'error';
}

function hostLabel(hosts: readonly ArchiveHost[]): string {
  return hosts.map((host) => host === 'filestore.me' ? 'Filestore' : 'Terabytez').join(' + ');
}

function sameHosts(left: readonly ArchiveHost[], right: readonly ArchiveHost[]): boolean {
  return [...left].sort().join('|') === [...right].sort().join('|');
}

export function historicalHostsToAdopt(
  result: FollowPreparationResponse,
  currentHosts: readonly ArchiveHost[],
  allowAdoption: boolean,
): ArchiveHost[] | null {
  if (!allowAdoption || result.matchedFiles !== 0 || !result.historicalHosts
    || sameHosts(result.historicalHosts, currentHosts)) return null;
  return [...result.historicalHosts];
}

export function describeFollowSeasonState(input: FollowPresentationInput): FollowPresentation {
  if (!input.enabled) return { text: 'Disattivato.', blocking: false, tone: 'idle' };
  if (!input.availability.available) {
    return { text: input.availability.reason, blocking: true, tone: 'error' };
  }
  if (input.preparation.pending) {
    return { text: 'Confronto con lo storico Segui…', blocking: true, tone: 'active' };
  }
  if (input.preparation.error) {
    return { text: input.preparation.error, blocking: true, tone: 'error' };
  }
  const result = input.preparation.result;
  if (!result) {
    return { text: 'Storico Segui da verificare.', blocking: true, tone: 'idle' };
  }
  if (!result.newCount) {
    return {
      text: 'Nessun nuovo link da elaborare per questa stagione e questo host.',
      blocking: true,
      tone: 'active',
    };
  }
  const summary = `Segui S${input.availability.season} attivo su ${hostLabel(input.hosts)} · ${result.processedCount} link già elaborati · ${result.newCount} nuovi.`;
  const changedHost = result.matchedFiles === 0 && result.historicalHosts
    && !sameHosts(result.historicalHosts, input.hosts);
  return {
    text: changedHost
      ? `${summary} Host diverso dallo storico: viene usata una catena host separata.`
      : summary,
    blocking: false,
    tone: 'active',
  };
}

export function resolveFollowSeasonAvailability(
  input: FollowAvailabilityInput,
): FollowAvailability {
  if (input.metadata?.mode !== 'validated' || input.metadata.mediaKind !== 'tv') {
    return { available: false, reason: 'Valida una serie con ID TMDB per usare Segui stagione.' };
  }
  const seasons = [...new Set(input.variants.map((variant) => variant.season))];
  if (!input.variants.length || seasons.length !== 1 || !Number.isSafeInteger(seasons[0])) {
    return { available: false, reason: 'Segui stagione richiede versioni di una sola stagione.' };
  }
  if (!input.hosts.length) {
    return { available: false, reason: 'Seleziona almeno un host per usare Segui stagione.' };
  }
  if (input.createMode !== 'quick') {
    return { available: false, reason: 'Segui stagione è disponibile soltanto con Quick Workflow.' };
  }
  if (!input.autodownload) {
    return { available: false, reason: 'Segui stagione richiede Autodownload attivo.' };
  }
  if (!input.logStatus.configured || !input.logStatus.name
    || !['granted', 'unknown'].includes(input.logStatus.permission)) {
    return { available: false, reason: 'Configura e autorizza la cartella log per usare Segui stagione.' };
  }
  return { available: true, season: seasons[0]! };
}

export class FollowSeasonPreparationController {
  private revision = 0;
  private current: FollowPreparationState = { pending: false, result: null, error: null };

  state(): FollowPreparationState {
    return this.current;
  }

  invalidate(): void {
    this.revision += 1;
    this.current = { pending: false, result: null, error: null };
  }

  async prepare(
    load: () => Promise<FollowPreparationResponse>,
  ): Promise<FollowPreparationResponse | null> {
    const revision = ++this.revision;
    this.current = { pending: true, result: null, error: null };
    try {
      const result = await load();
      if (revision !== this.revision) return null;
      this.current = { pending: false, result, error: null };
      return result;
    } catch (reason) {
      if (revision !== this.revision) return null;
      const message = reason instanceof Error ? reason.message : 'Preparazione Segui non riuscita.';
      this.current = { pending: false, result: null, error: message };
      throw reason;
    }
  }
}
