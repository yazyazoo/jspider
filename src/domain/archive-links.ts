export const ARCHIVE_HOSTS = ['filestore.me', 'terabytez.org'] as const;

export type ArchiveHost = (typeof ARCHIVE_HOSTS)[number];

export function normalizeArchiveUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const knownHost = ARCHIVE_HOSTS.includes(url.hostname as ArchiveHost);
    const directArchive = /\.(?:rar|rev)$/i.test(url.pathname);
    const bareFileId = /^\/[a-z0-9]{12}\/?$/i.test(url.pathname)
      && !url.search && !url.hash;
    if (url.protocol !== 'https:' || !knownHost || url.port || url.username || url.password) {
      return null;
    }
    return directArchive || bareFileId ? url.href : null;
  } catch {
    return null;
  }
}

export function selectArchiveLinks(values: readonly unknown[], hosts: readonly ArchiveHost[]): string[] {
  const selected = new Set(hosts.filter((host) => ARCHIVE_HOSTS.includes(host)));
  return [...new Set(values.map(normalizeArchiveUrl).filter((value): value is string => value !== null))]
    .filter((value) => selected.has(new URL(value).hostname as ArchiveHost));
}

