export interface ActionTab {
  id?: number | undefined;
  url?: string | undefined;
}

export interface ActionDependencies {
  sendMessage(tabId: number, message: Record<string, unknown>): Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isSupportedOverlayUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
    if (url.hostname === 'titanhd.space') return /^\/catalogo\/\d+\/?$/.test(url.pathname);
    return url.hostname === 'laforestaincantata.org'
      && url.pathname === '/index.php'
      && url.searchParams.getAll('newsid').length === 1
      && /^[1-9]\d*$/.test(url.searchParams.get('newsid') ?? '');
  } catch {
    return false;
  }
}

export async function handleActionClick(
  tab: ActionTab,
  dependencies: ActionDependencies,
): Promise<boolean> {
  if (tab.id === undefined || !tab.url || !isSupportedOverlayUrl(tab.url)) return false;
  try {
    const response = await dependencies.sendMessage(tab.id, {
      target: 'content', action: 'overlay.toggle',
    });
    return isRecord(response) && response.ok === true;
  } catch {
    return false;
  }
}
