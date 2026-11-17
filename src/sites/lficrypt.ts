import { normalizeArchiveUrl } from '../domain/archive-links';

export function normalizeLfiCryptUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['lficrypt.org', 'www.lficrypt.org'].includes(url.hostname)
      || url.port || url.username || url.password
      || !/^\/[a-z0-9]{6,32}\.html$/i.test(url.pathname) || url.search) return null;
    return `https://lficrypt.org${url.pathname}`;
  } catch { return null; }
}

export async function resolveLfiCrypt(
  value: unknown,
  request: (collectorUrl: string) => Promise<unknown>,
): Promise<string[]> {
  const collectorUrl = normalizeLfiCryptUrl(value);
  if (!collectorUrl) throw new Error('Raccoglitore LFiCrypt non valido.');
  const raw = await request(collectorUrl);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)
    || (raw as Record<string, unknown>).ok !== true
    || !Array.isArray((raw as Record<string, unknown>).links)
    || ((raw as Record<string, unknown>).links as unknown[]).length > 10_000) {
    throw new Error('LFiCrypt non ha restituito una lista di link valida.');
  }
  const links = [...new Set(((raw as Record<string, unknown>).links as unknown[])
    .map(normalizeArchiveUrl).filter((link): link is string => link !== null))];
  if (!links.length) throw new Error('Nessun link Filestore o Terabytez disponibile nel raccoglitore LFiCrypt.');
  return links;
}

