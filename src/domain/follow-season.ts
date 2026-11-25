import {
  ARCHIVE_HOSTS,
  normalizeArchiveUrl,
  selectArchiveLinks,
  type ArchiveHost,
} from './archive-links';
import type { ReleaseVariant } from './models';

export interface FollowSeasonKey {
  mediaKind: 'tv';
  tmdbId: number;
  season: number;
  hosts: ArchiveHost[];
}

export interface FollowSeasonLogContext extends FollowSeasonKey {
  title: string;
}

export interface FollowVariantPreparation {
  variants: ReleaseVariant[];
  currentCount: number;
  processedCount: number;
  newCount: number;
}

const HOST_TOKENS: Record<ArchiveHost, string> = {
  'filestore.me': 'filestore',
  'terabytez.org': 'terabytez',
};
const TOKEN_HOSTS = Object.fromEntries(
  Object.entries(HOST_TOKENS).map(([host, token]) => [token, host]),
) as Record<string, ArchiveHost>;

export function normalizeFollowHosts(hosts: readonly ArchiveHost[]): ArchiveHost[] {
  return ARCHIVE_HOSTS.filter((host) => hosts.includes(host));
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function timestamp(startedAt: string): string {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) throw new Error('Data log Segui non valida.');
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-')
    + '_'
    + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds()), pad(date.getMilliseconds(), 3)].join('-');
}

function safeFilenamePart(value: string, fallback: string): string {
  return value.trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .slice(0, 100) || fallback;
}

function requireKey(key: FollowSeasonKey): FollowSeasonKey {
  const hosts = normalizeFollowHosts(key.hosts);
  if (key.mediaKind !== 'tv' || !Number.isSafeInteger(key.tmdbId) || key.tmdbId <= 0
    || !Number.isSafeInteger(key.season) || key.season < 0 || !hosts.length) {
    throw new Error('Identità Segui stagione non valida.');
  }
  return { ...key, hosts };
}

export function createFollowLogFilename(
  context: FollowSeasonLogContext,
  startedAt: string,
): string {
  const key = requireKey(context);
  const hosts = key.hosts.map((host) => HOST_TOKENS[host]).join('+');
  const title = safeFilenamePart(context.title, 'Serie');
  const season = `S${pad(key.season)}`;
  return `${timestamp(startedAt)}_follow_tmdb-tv-${key.tmdbId}_host-${hosts}_${title}_${season}.json`;
}

export function parseFollowLogFilename(filename: string): FollowSeasonKey | null {
  const match = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}_follow_tmdb-tv-(\d+)_host-([a-z]+(?:\+[a-z]+)*)_.+_S(\d+)\.json$/i
    .exec(filename);
  if (!match) return null;
  const hosts = match[2]!.toLowerCase().split('+').map((token) => TOKEN_HOSTS[token]);
  if (hosts.some((host) => host === undefined)) return null;
  try {
    return requireKey({
      mediaKind: 'tv', tmdbId: Number(match[1]), season: Number(match[3]),
      hosts: hosts as ArchiveHost[],
    });
  } catch {
    return null;
  }
}

export function sameFollowChain(left: FollowSeasonKey, right: FollowSeasonKey): boolean {
  return left.mediaKind === right.mediaKind
    && left.tmdbId === right.tmdbId
    && left.season === right.season
    && normalizeFollowHosts(left.hosts).join('|') === normalizeFollowHosts(right.hosts).join('|');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireLogEntries(document: unknown): Array<Record<string, unknown>> {
  if (!isRecord(document) || typeof document.runId !== 'string'
    || typeof document.workflowName !== 'string' || typeof document.fileName !== 'string'
    || typeof document.startedAt !== 'string' || typeof document.updatedAt !== 'string'
    || !Array.isArray(document.entries)
    || document.entries.some((entry) => !isRecord(entry)
      || typeof entry.phase !== 'string' || typeof entry.kind !== 'string')) {
    throw new Error('Log Segui non valido.');
  }
  return document.entries as Array<Record<string, unknown>>;
}

export function hasSuccessfulFollowStart(document: unknown): boolean {
  return requireLogEntries(document)
    .some((entry) => entry.phase === 'start' && entry.kind === 'response');
}

export function readProcessedFollowLinks(documents: readonly unknown[]): Set<string> {
  const processed = new Set<string>();
  for (const document of documents) {
    const entries = requireLogEntries(document);
    const started = hasSuccessfulFollowStart(document);
    if (!started) continue;
    const submission = entries.find((entry) => entry.phase === 'submission' && entry.kind === 'request');
    if (!submission || !isRecord(submission.payload) || !Array.isArray(submission.payload.packages)) {
      throw new Error('Submission mancante nel log Segui riuscito.');
    }
    for (const item of submission.payload.packages) {
      if (!isRecord(item) || !Array.isArray(item.links)) {
        throw new Error('Submission non valida nel log Segui riuscito.');
      }
      for (const rawLink of item.links) {
        const link = normalizeArchiveUrl(rawLink);
        if (!link) throw new Error('Link archivio non valido nel log Segui riuscito.');
        processed.add(link);
      }
    }
  }
  return processed;
}

export function prepareFollowVariants(
  variants: readonly ReleaseVariant[],
  hosts: readonly ArchiveHost[],
  processedLinks: ReadonlySet<string>,
): FollowVariantPreparation {
  const currentLinks = new Set(variants.flatMap((variant) => selectArchiveLinks(variant.links, hosts)));
  const processedCount = [...currentLinks].filter((link) => processedLinks.has(link)).length;
  const emitted = new Set<string>();
  const prepared = variants.flatMap((variant) => {
    const links = selectArchiveLinks(variant.links, hosts).filter((link) => {
      if (processedLinks.has(link) || emitted.has(link)) return false;
      emitted.add(link);
      return true;
    });
    return links.length ? [{ ...variant, links }] : [];
  });
  const newLinks = new Set(prepared.flatMap((variant) => variant.links));
  return {
    variants: prepared,
    currentCount: currentLinks.size,
    processedCount,
    newCount: newLinks.size,
  };
}
