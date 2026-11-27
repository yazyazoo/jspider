import type { ArticleAdapter } from '../sites/contracts';
import { resolveArticleModule } from '../sites/registry';
import { createOverlayController } from './overlay';

type Message = { target?: string; action?: string; variantKeys?: string[]; width?: number };

const overlay = createOverlayController(
  document,
  (path) => chrome.runtime.getURL(path),
  {
    get: (key) => chrome.storage.local.get(key),
    set: (items) => chrome.storage.local.set(items),
  },
);

async function handle(message: Message): Promise<unknown> {
  const adapter = resolveContentArticle(location.href);
  if (!adapter) throw new Error('Questa pagina non è supportata da JSpider.');
  if (message.action === 'overlay.toggle') return overlay.toggle();
  if (message.action === 'overlay.status') return overlay.status();
  if (message.action === 'overlay.resize') return overlay.resize(Number(message.width));
  if (message.action === 'snapshot' || message.action === 'refresh') {
    return adapter.loadPage ? adapter.loadPage(document, location.href) : adapter.readPage(document, location.href);
  }
  if (message.action === 'thank') {
    if (!adapter.thankSelected) throw new Error('Il sito non supporta il ringraziamento da JSpider.');
    return adapter.thankSelected(document, location.href, message.variantKeys ?? []);
  }
  throw new Error('Azione pagina non supportata.');
}

export function resolveContentArticle(url: string): ArticleAdapter | null {
  return resolveArticleModule(url)?.article ?? null;
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.target !== 'content') return undefined;
  void handle(message).then(
    (data) => sendResponse({ ok: true, data }),
    (reason) => sendResponse({
      ok: false,
      error: { message: reason instanceof Error ? reason.message : 'Operazione pagina non riuscita.' },
    }),
  );
  return true;
});

