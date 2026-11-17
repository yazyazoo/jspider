import type { QuickWorkflowLogDocument } from '../background/quick-workflow-log';

export interface QuickWorkflowLogView {
  state: HTMLElement;
  entries: HTMLElement;
  copyButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
}

export interface QuickWorkflowLogDependencies {
  load(): Promise<QuickWorkflowLogDocument | null>;
  clear(): Promise<void>;
  copy(value: string): Promise<void>;
}

const phaseLabel = { submission: 'Submission', create: 'Create', start: 'Start' } as const;
const kindLabel = { request: 'richiesta', response: 'risposta', error: 'errore' } as const;

export function copyText(
  value: string,
  root: Document = document,
  execute: (command: string) => boolean = (command) => root.execCommand(command),
): boolean {
  const source = root.createElement('textarea');
  source.dataset.quickLogCopySource = '';
  source.value = value;
  source.setAttribute('readonly', '');
  source.style.position = 'fixed';
  source.style.opacity = '0';
  root.body.append(source);
  source.select();
  try { return execute('copy'); }
  finally { source.remove(); }
}

export function renderQuickWorkflowLog(
  view: QuickWorkflowLogView,
  log: QuickWorkflowLogDocument | null,
): void {
  view.entries.replaceChildren();
  view.copyButton.disabled = log === null;
  view.clearButton.disabled = log === null;
  if (!log) {
    view.state.textContent = 'Nessuna esecuzione Quick Workflow registrata.';
    return;
  }
  view.state.textContent = log.entries.length
    ? `Ultima esecuzione: ${new Date(log.startedAt).toLocaleString('it-IT')}`
    : 'Quick Workflow avviato; in attesa del primo JSON.';
  for (const entry of log.entries) {
    const details = document.createElement('details');
    details.className = 'quick-log-entry';
    if (entry.kind === 'error') {
      details.classList.add('error');
      details.open = true;
    }
    const summary = document.createElement('summary');
    const time = new Date(entry.timestamp).toLocaleTimeString('it-IT');
    summary.textContent = `${phaseLabel[entry.phase]} · ${kindLabel[entry.kind]} · ${time}`;
    const json = document.createElement('pre');
    json.textContent = JSON.stringify(
      entry.metadata ? { metadata: entry.metadata, body: entry.payload } : entry.payload,
      null,
      2,
    );
    details.append(summary, json);
    view.entries.append(details);
  }
}

export function initializeQuickWorkflowLog(
  view: QuickWorkflowLogView,
  dependencies: QuickWorkflowLogDependencies,
): {
  refresh(): Promise<void>;
  copy(): Promise<void>;
  clear(): Promise<void>;
  dispose(): void;
} {
  let current: QuickWorkflowLogDocument | null = null;
  const refresh = async () => {
    current = await dependencies.load();
    renderQuickWorkflowLog(view, current);
  };
  const copy = async () => {
    if (!current) return;
    await dependencies.copy(JSON.stringify(current, null, 2));
  };
  const clear = async () => {
    await dependencies.clear();
    current = null;
    renderQuickWorkflowLog(view, null);
  };
  const copyClick = () => { void copy(); };
  const clearClick = () => { void clear(); };
  view.copyButton.addEventListener('click', copyClick);
  view.clearButton.addEventListener('click', clearClick);
  renderQuickWorkflowLog(view, null);
  return {
    refresh, copy, clear,
    dispose() {
      view.copyButton.removeEventListener('click', copyClick);
      view.clearButton.removeEventListener('click', clearClick);
    },
  };
}
