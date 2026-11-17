import {
  LogDirectoryRepository,
  type WritableDirectoryHandle,
} from '../background/log-directory';
import { initializeLogDirectoryPicker } from './controller';

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker(options: {
    id: string;
    mode: 'readwrite';
    startIn: 'desktop';
  }): Promise<WritableDirectoryHandle>;
}
const chooseButton = document.getElementById('choose-directory') as HTMLButtonElement;
const state = document.getElementById('directory-state') as HTMLElement;
const pickerWindow = window as unknown as Partial<DirectoryPickerWindow>;
const repository = new LogDirectoryRepository();

if (typeof pickerWindow.showDirectoryPicker !== 'function') {
  chooseButton.disabled = true;
  state.textContent = 'Questo browser Chromium non espone il selettore di cartelle richiesto.';
} else {
  initializeLogDirectoryPicker({ chooseButton, state }, {
    pick: () => pickerWindow.showDirectoryPicker!({
      id: 'jspider-quick-workflow-logs', mode: 'readwrite', startIn: 'desktop',
    }),
    save: (handle) => repository.save(handle),
    publish: (items) => chrome.storage.local.set(items),
  });
  void repository.status().then((status) => {
    if (status.configured && status.name) {
      state.textContent = status.permission === 'prompt' || status.permission === 'denied'
        ? `La cartella “${status.name}” richiede una nuova autorizzazione.`
        : `Cartella attuale: “${status.name}”.`;
    }
  }).catch(() => undefined);
}
