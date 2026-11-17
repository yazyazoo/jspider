export const OVERLAY_WIDTHS = [420, 520, 650, 780, 900] as const;
export const OVERLAY_STORAGE_KEY = 'jspider.overlayWidth';
const DEFAULT_WIDTH = 650;
const HOST_ID = 'jspider-overlay-host';

export interface OverlayStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface OverlayStatus {
  open: boolean;
  width: number;
}

export interface OverlayController {
  toggle(): Promise<OverlayStatus>;
  resize(width: number): Promise<OverlayStatus>;
  status(): Promise<OverlayStatus>;
}

function supportedWidth(value: unknown): number {
  return typeof value === 'number' && (OVERLAY_WIDTHS as readonly number[]).includes(value)
    ? value : DEFAULT_WIDTH;
}

export function createOverlayController(
  document: Document,
  runtimeUrl: (path: string) => string,
  storage: OverlayStorage,
): OverlayController {
  let currentWidth = DEFAULT_WIDTH;
  let frame: HTMLIFrameElement | null = null;
  let work: Promise<unknown> = Promise.resolve();

  const readPersistedWidth = async () => {
    const stored = await storage.get(OVERLAY_STORAGE_KEY);
    currentWidth = supportedWidth(stored[OVERLAY_STORAGE_KEY]);
  };

  const state = (): OverlayStatus => ({ open: frame?.isConnected === true, width: currentWidth });
  const applyWidth = (target: HTMLIFrameElement, width: number) => {
    target.style.width = `${width}px`;
    target.style.maxWidth = 'calc(100vw - 24px)';
  };
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = work.then(operation, operation);
    work = next.then(() => undefined, () => undefined);
    return next;
  };

  const toggle = () => enqueue(async () => {
    if (frame?.isConnected) {
      document.getElementById(HOST_ID)?.remove();
      frame = null;
      return state();
    }
    await readPersistedWidth();
    document.getElementById(HOST_ID)?.remove();
    const host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = ':host{all:initial}iframe{position:fixed;top:12px;right:12px;height:calc(100vh - 24px);z-index:2147483646;border:1px solid #3b525b;border-radius:18px;box-shadow:0 16px 70px #000a;background:#111d27}';
    frame = document.createElement('iframe');
    frame.title = 'JSpider — versioni, TMDB e TaskFlow';
    frame.src = runtimeUrl('sidebar.html?surface=overlay');
    applyWidth(frame, currentWidth);
    shadow.append(style, frame);
    (document.body ?? document.documentElement).append(host);
    return state();
  });

  const resize = (width: number) => enqueue(async () => {
    if (!(OVERLAY_WIDTHS as readonly number[]).includes(width)) {
      throw new Error('Seleziona una larghezza JSpider supportata.');
    }
    currentWidth = width;
    if (frame?.isConnected) applyWidth(frame, width);
    await storage.set({ [OVERLAY_STORAGE_KEY]: width });
    return state();
  });

  const status = () => enqueue(async () => {
    if (!frame?.isConnected) await readPersistedWidth();
    return state();
  });

  return { toggle, resize, status };
}
