export interface TaskFlowWebUiVersion {
  source: string;
  etag: string | null;
  lastModified: string | null;
  sha256: string;
  syncedAt: string;
}

export interface TaskFlowWebUiVersionResult {
  state: 'current' | 'update-available';
  liveSha256: string;
  etag: string | null;
  lastModified: string | null;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function sha256Hex(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function checkTaskFlowWebUiVersion(
  embedded: TaskFlowWebUiVersion,
  fetcher: Fetcher = fetch,
): Promise<TaskFlowWebUiVersionResult> {
  const response = await fetcher(embedded.source, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const liveSha256 = await sha256Hex(await response.arrayBuffer());
  return {
    state: liveSha256 === embedded.sha256 ? 'current' : 'update-available',
    liveSha256,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  };
}

export interface WebUiVersionView {
  button: HTMLButtonElement;
  state: HTMLElement;
}

export interface WebUiVersionDependencies {
  loadEmbedded(): Promise<TaskFlowWebUiVersion>;
  check?(embedded: TaskFlowWebUiVersion): Promise<TaskFlowWebUiVersionResult>;
}

export function initializeWebUiVersionCheck(
  view: WebUiVersionView,
  dependencies: WebUiVersionDependencies,
): { refresh(): Promise<void>; dispose(): void } {
  let disposed = false;
  const refresh = async (): Promise<void> => {
    view.button.disabled = true;
    view.state.classList.remove('error-text');
    view.state.textContent = 'Controllo versione WebUI in corso…';
    try {
      const embedded = await dependencies.loadEmbedded();
      const result = await (dependencies.check ?? checkTaskFlowWebUiVersion)(embedded);
      if (disposed) return;
      const shortHash = result.liveSha256.slice(0, 12);
      view.state.textContent = result.state === 'current'
        ? `WebUI TaskFlow aggiornata · ${shortHash}`
        : `Aggiornamento disponibile · esegui Aggiorna-WebUI.cmd su Windows oppure Aggiorna-WebUI.command su macOS dalla root JSpider.`;
    } catch (reason) {
      if (disposed) return;
      const message = reason instanceof Error ? reason.message : 'errore sconosciuto';
      view.state.textContent = `Versione WebUI non verificabile: ${message}`;
      view.state.classList.add('error-text');
    } finally {
      if (!disposed) view.button.disabled = false;
    }
  };
  const click = (): void => { void refresh(); };
  view.button.addEventListener('click', click);
  return {
    refresh,
    dispose() {
      disposed = true;
      view.button.removeEventListener('click', click);
    },
  };
}
