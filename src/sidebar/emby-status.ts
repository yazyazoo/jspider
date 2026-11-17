import type { EmbyPresenceResult } from '../domain/emby';

export type EmbyStatus =
  | { state: 'idle' | 'checking' }
  | EmbyPresenceResult
  | { state: 'unavailable'; message: string };

function led(document: Document, state: EmbyStatus['state']): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = `emby-led ${state}`;
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export function renderEmbyStatus(container: HTMLElement, status: EmbyStatus): void {
  const document = container.ownerDocument;
  container.replaceChildren();
  container.className = `emby-status ${status.state}`;

  const heading = document.createElement('strong');
  heading.className = 'emby-heading';
  heading.textContent = 'Libreria Emby';
  container.append(heading);

  const list = document.createElement('div');
  list.className = 'emby-file-list';
  container.append(list);

  if (status.state === 'present' || status.state === 'ambiguous') {
    const files = status.files.length ? status.files : ['Nome file non disponibile'];
    for (const file of files) {
      const row = document.createElement('div');
      row.className = 'emby-file-row';
      const name = document.createElement('span');
      name.className = 'emby-file-name';
      name.textContent = file;
      row.append(led(document, status.state === 'present' ? 'present' : 'ambiguous'), name);
      list.append(row);
    }
  } else {
    const row = document.createElement('div');
    row.className = 'emby-file-row';
    row.append(led(document, status.state));
    if (status.state === 'idle') row.append('Valida il titolo per controllare la libreria.');
    if (status.state === 'checking') row.append('Controllo in corso…');
    if (status.state === 'absent') row.append('Nessun file trovato.');
    if (status.state === 'unavailable') row.append(status.message);
    list.append(row);
  }

  const label = document.createElement('span');
  label.className = 'emby-result-label';
  label.textContent = {
    idle: 'In attesa',
    checking: 'Verifica',
    present: 'Presente',
    absent: 'Assente',
    ambiguous: 'Ambiguo',
    unavailable: 'Non verificabile',
  }[status.state];
  container.append(label);
}
